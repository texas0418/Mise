/**
 * utils/festivalCatalogPolicy.ts
 *
 * How to read a festival listing. No AsyncStorage, no fetch, no React — kept
 * dependency-free and separate from utils/festivalCatalog.ts so the rules can
 * be reasoned about and tested without a native runtime, the same split as
 * reviewPolicy and reviewPrompt.
 *
 * The rules that matter are about honesty. 1,408 of the 2,662 listings carry
 * `dates_elsewhere`, meaning the festival publishes deadlines on a submission
 * platform and this calendar genuinely has none. Another 456 carry
 * `estimated`, meaning the dates shown are LAST season's. Presenting either as
 * a current deadline would have a director miss a real festival, which is the
 * one unforgivable bug in a tool like this. describeDates() is the only place
 * allowed to turn a listing into a date, so no call site can forget.
 */
export type FestivalKind = 'festival' | 'contest' | 'fund';

export interface CatalogDeadline {
  label: string;
  date: string;
  fee?: number | null;
}

export interface CatalogEntry {
  id: string;
  type: FestivalKind;
  name: string;
  city?: string;
  country?: string;
  website?: string;
  categories?: string[];
  cycle?: string;
  estimated?: boolean;
  deadlines?: CatalogDeadline[];
  final_deadline?: string;
  opens?: string;
  notification?: string;
  event_start?: string;
  event_end?: string;
  blurb?: string;
  oscar?: boolean;
  bafta?: boolean;
  region?: string;
  fee_min_usd?: number | null;
  dates_elsewhere?: boolean;
  status_note?: string;
}

export interface Catalog {
  built: string;
  festivals: CatalogEntry[];
  /** Where this copy came from, so the UI can be honest about staleness. */
  origin: 'bundled' | 'cached' | 'network';
}

// ─── Reading a listing honestly ───────────────────────────────────────────────

export interface DateDescription {
  /** Short text for a list row. */
  short: string;
  /** The caveat, when there is one. Shown wherever there is room. */
  caveat: string | null;
  /** ISO date safe to put in a tracker deadline field, or '' when there is none. */
  deadline: string;
}

/**
 * The single place a listing becomes a date. Matches the website's wording in
 * site/app.js so a director reading both does not get two different answers.
 */
export function describeDates(f: CatalogEntry): DateDescription {
  if (f.dates_elsewhere) {
    return {
      short: 'See festival site',
      caveat: "Deadlines are on its submission page, linked from the festival's site.",
      deadline: '',
    };
  }
  const final = f.final_deadline
    ?? (f.deadlines && f.deadlines.length ? f.deadlines[f.deadlines.length - 1].date : undefined);
  if (!final) {
    return {
      short: 'Dates TBA',
      caveat: "Dates not published yet. Check the festival's site.",
      deadline: '',
    };
  }
  if (f.estimated) {
    return {
      short: `${final} (last season)`,
      caveat: `These are last season's dates${f.cycle ? ` (${f.cycle})` : ''}. The festival has not announced its next season yet.`,
      /* Deliberately empty: a last-season date must never reach a tracker
       * field or a deadline alert as though it were real. */
      deadline: '',
    };
  }
  return { short: final, caveat: null, deadline: final };
}

/** Lowest entry fee in USD, or null when the calendar does not know. */
export function lowestFee(f: CatalogEntry): number | null {
  if (typeof f.fee_min_usd === 'number') return f.fee_min_usd;
  const fees = (f.deadlines ?? []).map(d => d.fee).filter((n): n is number => typeof n === 'number');
  return fees.length ? Math.min(...fees) : null;
}

export function placeOf(f: CatalogEntry): string {
  return [f.city, f.country].filter(Boolean).join(', ');
}

// ─── Filtering ────────────────────────────────────────────────────────────────

export interface CatalogFilters {
  query: string;
  type: FestivalKind | null;
  category: string | null;
  region: string | null;
  /** 'free' means no entry fee; a number means "at most this much". */
  maxFee: 'free' | number | null;
  qualifying: 'oscar' | 'bafta' | null;
}

export const EMPTY_FILTERS: CatalogFilters = {
  query: '', type: null, category: null, region: null, maxFee: null, qualifying: null,
};

/** Does this listing clear the fee filter? Separated so `matches` stays simple. */
function matchesFee(f: CatalogEntry, maxFee: CatalogFilters['maxFee']): boolean {
  if (maxFee === null) return true;
  const fee = lowestFee(f);
  /* Unknown fee fails a fee filter rather than sneaking through: the site
   * does the same, and a surprise entry fee is worse than a missing row. */
  if (fee === null) return false;
  return maxFee === 'free' ? fee === 0 : fee <= maxFee;
}

/** Free-text search across the fields a director would actually type. */
function matchesQuery(f: CatalogEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [f.name, f.city, f.country, f.region, ...(f.categories ?? [])]
    .filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
}

function matchesQualifying(f: CatalogEntry, q: CatalogFilters['qualifying']): boolean {
  if (q === 'oscar') return !!f.oscar;
  if (q === 'bafta') return !!f.bafta;
  return true;
}

export function matches(f: CatalogEntry, s: CatalogFilters): boolean {
  if (s.type && f.type !== s.type) return false;
  if (!matchesQualifying(f, s.qualifying)) return false;
  if (s.region && f.region !== s.region) return false;
  if (s.category && !(f.categories ?? []).includes(s.category)) return false;
  if (!matchesFee(f, s.maxFee)) return false;
  return matchesQuery(f, s.query);
}

/** Categories present in the data, commonest first, with the qualifying pair on top. */
export function categoriesOf(list: CatalogEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const f of list) for (const c of f.categories ?? []) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

export function regionsOf(list: CatalogEntry[]): string[] {
  return [...new Set(list.map(f => f.region).filter((r): r is string => !!r))].sort();
}
