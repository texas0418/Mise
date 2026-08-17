/**
 * supabase/functions/revenuecat-webhook/index.ts
 *
 * Makes entitlement authoritative.
 *
 * Until this existed, `entitlements` was written by the client (#112) under
 * owner RLS — meaning the record of who had paid was, in the end, the user's
 * own claim about themselves. That was tolerable while entitlement was only
 * read on-device by an app the App Store had already gated, and it stops being
 * tolerable the moment a browser build reads the same row to decide whether to
 * open at all.
 *
 * So: RevenueCat states what was bought, this function writes it with the
 * service role, and the client's write is revoked
 * (supabase/migrations/20260817_entitlements_server_authoritative.sql).
 *
 * ## What has to be true for this to attribute anything
 *
 * The app must call `Purchases.logIn(user.id)` (PR #115). Without it every
 * event arrives against an anonymous per-install id and is dropped here as
 * unattributable. That fix only takes effect for a customer once a build
 * carrying it runs on their device, so this webhook fills `entitlements` in
 * gradually as people update — it does not backfill.
 *
 * ## Deployment
 *
 * `verify_jwt: false`, necessarily: RevenueCat cannot mint a Supabase JWT.
 * The function does its own authentication instead, comparing the whole
 * `Authorization` header against REVENUECAT_WEBHOOK_SECRET, and refuses to
 * serve at all if that secret is not configured.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { decide, isStale, type Decision, type RevenueCatEvent } from './entitlementFromEvent.ts';

/**
 * Compare in time independent of how much of the string matched.
 *
 * A plain `===` leaks the length of the matching prefix through timing, which
 * over enough requests is enough to recover the secret a character at a time.
 * The length check is deliberately not short-circuited into the loop.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * The service-role client. Written as a factory so `Supabase` below resolves
 * to a concrete client type — `ReturnType<typeof createClient>` leaves the
 * schema generic unresolved and every query then typechecks against `never`.
 */
function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
}

type Supabase = ReturnType<typeof serviceClient>;

/**
 * Refuse anything that is not an authenticated RevenueCat POST.
 *
 * Returns the response to send, or null to continue.
 */
function reject(req: Request): Response | null {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret) {
    // Fail closed. An unconfigured secret must never mean "let everything in":
    // this endpoint grants paid access and is on the public internet.
    console.error('[revenuecat-webhook] REVENUECAT_WEBHOOK_SECRET is not set');
    return json(500, { error: 'webhook is not configured' });
  }

  if (!constantTimeEqual(req.headers.get('Authorization') ?? '', secret)) {
    console.warn('[revenuecat-webhook] rejected: bad Authorization header');
    return json(401, { error: 'unauthorized' });
  }

  return null;
}

/**
 * Record the delivery, including the ones deliberately skipped.
 *
 * When somebody asks "why does my laptop say I'm not subscribed", the answer
 * is almost always an event that arrived and was skipped for a stated reason,
 * and without this there is nothing to read.
 *
 * A failure here is logged and swallowed: losing the audit line is bad, and
 * far better than dropping an entitlement change because the log misbehaved.
 */
async function logDelivery(
  supabase: Supabase,
  event: RevenueCatEvent | undefined,
  decision: Decision
): Promise<void> {
  const { error } = await supabase.from('revenuecat_events').upsert(
    {
      event_id: event?.id ?? crypto.randomUUID(),
      event_type: event?.type ?? null,
      app_user_id: event?.app_user_id ?? null,
      user_id: decision.action === 'apply' ? decision.userId : null,
      outcome: decision.action,
      reason: decision.reason,
      payload: event ?? null,
    },
    { onConflict: 'event_id' }
  );
  if (error) console.warn('[revenuecat-webhook] event log failed:', error.message);
}

/** Write the decided entitlement, unless a newer event already superseded it. */
async function applyDecision(
  supabase: Supabase,
  decision: Extract<Decision, { action: 'apply' }>
): Promise<Response> {
  // Out-of-order delivery guard. RevenueCat retries failures, so a stale
  // EXPIRATION can land after the RENEWAL that superseded it.
  const existing = await supabase
    .from('entitlements')
    .select('last_event_at')
    .eq('user_id', decision.userId)
    .maybeSingle();

  if (existing.error) {
    console.error('[revenuecat-webhook] read failed:', existing.error.message);
    return json(500, { error: 'could not read current entitlement' });
  }

  const appliedAt = (existing.data as { last_event_at?: string } | null)?.last_event_at;
  if (isStale(appliedAt, decision.eventAt)) {
    console.log(`[revenuecat-webhook] stale event: ${decision.eventAt} <= ${appliedAt}`);
    return json(200, { ok: true, applied: false, reason: 'superseded by a newer event' });
  }

  const { error } = await supabase.from('entitlements').upsert(
    {
      user_id: decision.userId,
      is_pro: decision.isPro,
      source: 'subscription',
      expires_at: decision.expiresAt,
      last_event_at: decision.eventAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    // 500 so RevenueCat retries. A dropped grant is a customer who paid and
    // cannot get in.
    console.error('[revenuecat-webhook] upsert failed:', error.message);
    return json(500, { error: 'could not write entitlement' });
  }

  console.log(
    `[revenuecat-webhook] ${decision.userId} is_pro=${decision.isPro} (${decision.reason})`
  );
  return json(200, { ok: true, applied: true, is_pro: decision.isPro });
}

Deno.serve(async (req: Request) => {
  const rejected = reject(req);
  if (rejected) return rejected;

  let payload: { event?: RevenueCatEvent };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'body is not JSON' });
  }

  const event = payload?.event;
  const decision = decide(event, Date.now());

  const supabase = serviceClient();

  await logDelivery(supabase, event, decision);

  if (decision.action === 'ignore') {
    console.log(`[revenuecat-webhook] ignored (${event?.type ?? 'no type'}): ${decision.reason}`);
    return json(200, { ok: true, applied: false, reason: decision.reason });
  }

  return applyDecision(supabase, decision);
});
