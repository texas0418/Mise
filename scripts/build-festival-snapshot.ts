/**
 * scripts/build-festival-snapshot.ts
 *
 *   node --experimental-strip-types scripts/build-festival-snapshot.ts [path-to-festivals.json]
 *
 * Rebuilds assets/data/festivals-snapshot.json, the copy of the festival
 * calendar that ships inside the app.
 *
 * Mise bundles a snapshot rather than relying on the network for two reasons.
 * The honest one first: festivals.page4films.com sits behind SiteGround's bot
 * protection, which answers any non-browser client with a captcha page and
 * HTTP 202 instead of the file. A React Native fetch is a native HTTP client,
 * not a browser, so it gets the captcha too. Until that host excludes /data/
 * from the shield, the bundled copy is the only copy the app can read.
 *
 * The second reason outlives the first: this app is used on set, where the
 * signal is somebody else's problem. Browsing festivals should not require a
 * network at all, and a snapshot that is weeks stale is far better than a
 * spinner. The runtime refresh in utils/festivalCatalog.ts layers on top and
 * starts working the moment the host stops challenging us.
 *
 * Fields are dropped rather than kept wholesale: source_url, verified_on,
 * oscar_categories, premiere and every_years are editorial plumbing for the
 * website and nothing in the app reads them. Blurbs ARE kept, at about 390KB,
 * because a listing without one is a name and a date and tells a director
 * nothing about whether to enter.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = process.argv[2]
  ?? `${process.env.HOME}/Documents/GitHub/festival-calendar/site/data/festivals.json`;
const OUT = 'assets/data/festivals-snapshot.json';

const KEEP = [
  'id', 'type', 'name', 'city', 'country', 'website', 'categories', 'cycle',
  'estimated', 'deadlines', 'final_deadline', 'opens', 'notification',
  'event_start', 'event_end', 'blurb', 'oscar', 'bafta', 'region',
  'fee_min_usd', 'dates_elsewhere', 'status_note',
] as const;

const raw = JSON.parse(readFileSync(SOURCE, 'utf8')) as {
  built?: string;
  festivals: Record<string, unknown>[];
};

/* Empty strings, empty arrays and false all mean "absent" in this data, and
 * 2,662 copies of `"oscar":false` is 40KB of nothing. null is kept out too. */
const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === '' || v === false
  || (Array.isArray(v) && v.length === 0);

const festivals = raw.festivals.map((f) => {
  const out: Record<string, unknown> = {};
  for (const k of KEEP) if (!isEmpty(f[k])) out[k] = f[k];
  return out;
});

const payload = JSON.stringify({ built: raw.built, festivals });
writeFileSync(OUT, payload);

const mb = (payload.length / 1e6).toFixed(2);
console.log(`${OUT}: ${festivals.length} listings, ${mb} MB, built ${raw.built}`);
