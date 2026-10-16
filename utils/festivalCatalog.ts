/**
 * utils/festivalCatalog.ts
 *
 * The festival calendar, as the app sees it.
 *
 * Two sources, in order of trust:
 *   1. assets/data/festivals-snapshot.json, bundled at build time. Always
 *      present, works with no network, never empty.
 *   2. festivals.page4films.com/data/festivals.json, fetched at runtime and
 *      cached. Newer when it arrives, ignored entirely when it does not.
 *
 * The remote half currently never arrives: that host is behind SiteGround's
 * bot protection, which answers a native HTTP client with a captcha page and
 * HTTP 202 rather than the file. `refresh()` detects that and gives up
 * quietly rather than caching a captcha as if it were a catalog. When the
 * host stops challenging, the same code starts working with no app change,
 * which is the point of writing it now.
 *
 * Dates here are not all equal and the UI must never pretend otherwise:
 *   - `dates_elsewhere` means the festival publishes deadlines on a
 *     submission platform instead of its own site. There is no date to show.
 *   - `estimated` means these are LAST season's dates. Showing them as
 *     current would have a director miss a real deadline, which is the one
 *     unforgivable bug in a tool like this.
 * `describeDates()` is the only place allowed to turn a listing into a date
 * string, so neither case can be forgotten at a call site.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CALENDAR_URL = 'https://festivals.page4films.com/data/festivals.json';
export const CALENDAR_SITE = 'https://festivals.page4films.com';

const CACHE_KEY = 'mise_festival_catalog_v1';
const CACHE_BUILT_KEY = 'mise_festival_catalog_built_v1';
/** A day. The calendar is rebuilt daily at most, so asking more often is rude. */
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LAST_TRY_KEY = 'mise_festival_catalog_last_try_v1';

import type { CatalogEntry, Catalog } from '@/utils/festivalCatalogPolicy';

export * from '@/utils/festivalCatalogPolicy';

/* The bundled copy, imported statically so Metro includes it in the binary. */
import SNAPSHOT from '@/assets/data/festivals-snapshot.json';

const BUNDLED = SNAPSHOT as { built: string; festivals: CatalogEntry[] };

/** The snapshot that shipped with this build. Never empty, never throws. */
export function bundledCatalog(): Catalog {
  return { built: BUNDLED.built, festivals: BUNDLED.festivals, origin: 'bundled' };
}

/**
 * The best catalog available right now, without touching the network: the
 * cached download if one is newer than the bundle, otherwise the bundle.
 */
export async function loadCatalog(): Promise<Catalog> {
  try {
    const [built, body] = await Promise.all([
      AsyncStorage.getItem(CACHE_BUILT_KEY),
      AsyncStorage.getItem(CACHE_KEY),
    ]);
    if (built && body && built > BUNDLED.built) {
      const parsed = JSON.parse(body) as { festivals: CatalogEntry[] };
      if (Array.isArray(parsed.festivals) && parsed.festivals.length > 0) {
        return { built, festivals: parsed.festivals, origin: 'cached' };
      }
    }
  } catch {
    /* A corrupt cache is not worth a crash; the bundle is always there. */
  }
  return bundledCatalog();
}

/**
 * Try the network. Returns the new catalog, or null when there is nothing
 * better than what we already have — including the captcha case.
 *
 * Deliberately quiet. Browsing festivals must work on a location scout with
 * no bars, so a failed refresh is not an error the user needs to see.
 */
export async function refreshCatalog(force = false): Promise<Catalog | null> {
  try {
    if (!force) {
      const last = await AsyncStorage.getItem(LAST_TRY_KEY);
      if (last && Date.now() - Number(last) < REFRESH_INTERVAL_MS) return null;
    }
    await AsyncStorage.setItem(LAST_TRY_KEY, String(Date.now()));

    const res = await fetch(CALENDAR_URL, { headers: { Accept: 'application/json' } });
    /* The bot shield answers 202 with HTML. A 200 that is not JSON is the
     * same trap wearing a different hat, so check the body, not the status. */
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.startsWith('{')) return null;

    const parsed = JSON.parse(text) as { built?: string; festivals?: CatalogEntry[] };
    if (!parsed.built || !Array.isArray(parsed.festivals) || parsed.festivals.length === 0) {
      return null;
    }
    if (parsed.built <= BUNDLED.built) return null;

    await AsyncStorage.multiSet([
      [CACHE_KEY, JSON.stringify({ festivals: parsed.festivals })],
      [CACHE_BUILT_KEY, parsed.built],
    ]);
    return { built: parsed.built, festivals: parsed.festivals, origin: 'network' };
  } catch {
    return null;
  }
}

