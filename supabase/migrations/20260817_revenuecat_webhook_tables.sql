-- 20260817_revenuecat_webhook_tables.sql
--
-- Storage the RevenueCat webhook needs before it can be trusted with the
-- entitlement record. Applied to project mnzkjdpwaibufwhirkon.
--
-- Two problems, both about a webhook being a thing you cannot watch happen:
--
--   1. RevenueCat retries failed deliveries, so events arrive out of order. An
--      EXPIRATION that failed at 10:00 can land after the RENEWAL that
--      succeeded at 10:05 and revoke a subscription that is current.
--      `entitlements.last_event_at` records which event the row reflects, and
--      the function drops anything not newer.
--
--   2. When a paying customer says the desktop build will not let them in,
--      there is otherwise nothing to look at. `revenuecat_events` keeps every
--      event, including the ones deliberately skipped and why.

alter table public.entitlements
  add column if not exists last_event_at timestamptz;

comment on column public.entitlements.last_event_at is
  'Timestamp of the RevenueCat event this row reflects. Older events are ignored.';

create table if not exists public.revenuecat_events (
  event_id    text primary key,
  event_type  text,
  app_user_id text,
  user_id     uuid references auth.users(id) on delete set null,
  outcome     text not null,
  reason      text,
  payload     jsonb,
  received_at timestamptz not null default now()
);

comment on table public.revenuecat_events is
  'Append-only log of RevenueCat webhook deliveries. Written by the service role only.';

create index if not exists revenuecat_events_user_id_idx
  on public.revenuecat_events (user_id, received_at desc);

-- RLS on with no policies at all: the service role bypasses RLS, and every
-- other role gets nothing. This log holds purchase history keyed to accounts
-- and there is no client that has any business reading it.
alter table public.revenuecat_events enable row level security;

-- RLS alone leaves the table listed in the auto-generated GraphQL schema,
-- because the role still holds SELECT even though every row is filtered out.
-- Nothing client-side reads this table, so take the grant away as well and
-- the table stops being discoverable at all.
revoke all on public.revenuecat_events from anon, authenticated;
