// ---------------------------------------------------------------------------
// lib/syncGate.ts: who syncs
//
// Mutations are always queued on the device. This decides only whether the
// queue is pushed and the server is pulled.
//
// Sync requires Pro (#43). Every person on a crew is a cost, so an invited
// crew member syncs a shared project on their own subscription, not the
// director's (Simon, 2026-11-03). Their edits are still queued on the device,
// never dropped, and go up once they subscribe.
// ---------------------------------------------------------------------------

/** Whether accepted crew sync shared projects without Pro of their own. They do not. */
export const CREW_SYNC_WITHOUT_PRO = false;

export interface SyncGateInput {
  signedIn: boolean;
  proEntitled: boolean;
  acceptedMemberships: number;
}

export function isSyncAllowed({ signedIn, proEntitled, acceptedMemberships }: SyncGateInput): boolean {
  if (!signedIn) return false;
  if (proEntitled) return true;
  return CREW_SYNC_WITHOUT_PRO && acceptedMemberships > 0;
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

export function onAcceptedProjectsChange(fn: (ids: string[]) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Ids in `next` that were not in `known`: projects this account just joined. */
export function newlyJoined(known: string[], next: string[]): string[] {
  const seen = new Set(known);
  return next.filter((id) => !seen.has(id));
}
