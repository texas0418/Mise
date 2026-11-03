// ---------------------------------------------------------------------------
// lib/storeWrites.ts: one write chain per storage key, for every writer
//
// Each storage key owns a promise chain. Every mutation runs as a step on that
// chain and reads its base state *inside* the step, so two mutations issued in
// the same tick see each other's result instead of both deriving from the same
// stale render snapshot and the second silently discarding the first.
//
// The chain used to live inside ProjectContext, so a sync pull or a realtime
// event wrote AsyncStorage outside it. A pull that landed between a mutation's
// read and its write was lost, and a mutation that read the in-memory cache
// after a pull wrote the pre-pull list back over it. Both now take a step on
// the same chain, and a sync write updates the in-memory cache in the same
// step through the listener ProjectContext registers.
// ---------------------------------------------------------------------------
import AsyncStorage from '@react-native-async-storage/async-storage';

const writeChains = new Map<string, Promise<void>>();

export function serializeWrite<T>(storageKey: string, step: () => Promise<T>): Promise<T> {
  const previous = writeChains.get(storageKey) ?? Promise.resolve();
  const next = previous.then(step);
  // Store a settled-either-way handle so one failed step can't stall the chain.
  writeChains.set(storageKey, next.then(() => undefined, () => undefined));
  return next;
}

type StoreWriteListener = (storageKey: string, items: Record<string, any>[]) => void;
let listener: StoreWriteListener | null = null;

/** ProjectContext registers this so sync writes land in the query cache too. */
export function setStoreWriteListener(fn: StoreWriteListener | null): void {
  listener = fn;
}

function parseList(raw: string | null): Record<string, any>[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Apply a sync-side change to one store, on its write chain. `update` gets the
 * stored list and returns the new one and how many records changed; nothing
 * is written when nothing changed. Resolves to that count.
 */
export function writeStoreFromSync(
  storageKey: string,
  update: (items: Record<string, any>[]) => { items: Record<string, any>[]; changed: number },
): Promise<number> {
  return serializeWrite(storageKey, async () => {
    const prev = parseList(await AsyncStorage.getItem(storageKey));
    const { items, changed } = update(prev);
    if (changed === 0) return 0;
    await AsyncStorage.setItem(storageKey, JSON.stringify(items));
    listener?.(storageKey, items);
    return changed;
  });
}
