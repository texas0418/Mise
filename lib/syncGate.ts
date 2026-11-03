// ---------------------------------------------------------------------------
// lib/syncGate.ts: who syncs
//
// Mutations are always queued on the device. This decides only whether the
// queue is pushed and the server is pulled.
//
// Sync used to require Pro on this device (#43). Crew a director invited do not
// usually hold Pro of their own, so every edit they made was dropped before it
// was even queued, with nothing on screen to say so. The rule now also lets in
// a signed-in account that has accepted at least one project membership.
//
// FLAGGED FOR SIMON: CREW_SYNC_WITHOUT_PRO is the default the 1.3.3 audit
// chose. Set it to false to go back to "Pro only"; nothing else needs to move.
// ---------------------------------------------------------------------------

/** Accepted crew sync their shared projects without buying Pro themselves. */
export const CREW_SYNC_WITHOUT_PRO = true;

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
