// ---------------------------------------------------------------------------
// lib/syncGate.ts: who syncs
//
// Mutations are always queued on the device. This decides only whether the
// queue is pushed and the server is pulled.
//
// Sync requires Pro of your own (#43), or a seat on a director's plan: Crew
// covers 5 people, Production 15, Studio 40, Slate 250, owner included
// (Simon, 2026-11-03). The server counts seats (20261103_crew_seats.sql) and
// says whether this account holds one; past the number, crew need their own
// subscription. Edits are always queued on the device, never dropped, and go
// up once the account may sync.
// ---------------------------------------------------------------------------

export interface SyncGateInput {
  signedIn: boolean;
  proEntitled: boolean;
  /** The server says a director's plan has a seat for this account. */
  seatCovered: boolean;
}

export function isSyncAllowed({ signedIn, proEntitled, seatCovered }: SyncGateInput): boolean {
  if (!signedIn) return false;
  return proEntitled || seatCovered;
}

// ---------------------------------------------------------------------------
// Accepted memberships, readable outside React (same reason as entitlement.ts)
// ---------------------------------------------------------------------------
let acceptedProjectIds: string[] = [];
const listeners = new Set<(ids: string[]) => void>();

export function getAcceptedProjectIds(): string[] {
  return acceptedProjectIds;
}

/** Set by the sync engine after it reads project_members. */
export function setAcceptedProjectIds(ids: string[]): void {
  const next = [...new Set(ids)].sort();
  if (next.join(',') === acceptedProjectIds.join(',')) return;
  acceptedProjectIds = next;
  listeners.forEach((fn) => fn(next));
}

let seatCovered = false;

export function getSeatCovered(): boolean {
  return seatCovered;
}

/** Set by the sync engine from public.mise_sync_access(). */
export function setSeatCovered(next: boolean): void {
  if (next === seatCovered) return;
  seatCovered = next;
  listeners.forEach((fn) => fn(acceptedProjectIds));
}

export function onAcceptedProjectsChange(fn: (ids: string[]) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Ids in `next` that were not in `known`: projects this account just joined. */
export function newlyJoined(known: string[], next: string[]): string[] {
  const seen = new Set(known);
  return next.filter((id) => !seen.has(id));
}
