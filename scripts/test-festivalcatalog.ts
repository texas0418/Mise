/**
 * scripts/test-festivalcatalog.ts
 *
 *   bun scripts/test-festivalcatalog.ts
 *
 * The festival calendar's reading rules, and the deadline arithmetic.
 *
 * The bug this suite exists to prevent is specific and expensive: showing a
 * director last season's deadline as though it were this season's. The data
 * marks those listings `estimated`, and 456 of 2,662 are. A tool that quietly
 * passed one of those into a tracker field would have somebody miss a real
 * festival, which is worse than the feature not existing.
 *
 * The same applies to `dates_elsewhere`, 1,408 of them, where the festival
 * publishes on a submission platform and the calendar genuinely has no date.
 */
import {
  describeDates, lowestFee, matches, EMPTY_FILTERS, categoriesOf, regionsOf,
  safeSiteUrl, siteHost, type CatalogEntry,
} from '@/utils/festivalCatalogPolicy';
import SNAPSHOT from '@/assets/data/festivals-snapshot.json';
import {
  fireDateFor, daysUntil, closingWithin, identifiersFor, LEAD_DAYS,
} from '@/utils/festivalDeadlinePolicy';
import type { FestivalSubmission } from '@/types';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, why = '') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${why ? `\n       ${why}` : ''}`); }
}
const entry = (o: Partial<CatalogEntry>): CatalogEntry =>
  ({ id: 'x', type: 'festival', name: 'X', ...o });

console.log('festival catalog');

// ─── the honesty rules ───────────────────────────────────────────────────────
const elsewhere = describeDates(entry({ dates_elsewhere: true, final_deadline: '2027-01-01' }));
ok('dates_elsewhere never yields a deadline', elsewhere.deadline === '',
  'the calendar has no date for these; anything in this field would be invented');
ok('dates_elsewhere says where to look', elsewhere.short === 'See festival site');

const estimated = describeDates(entry({ estimated: true, final_deadline: '2027-03-01', cycle: '2026' }));
ok('estimated never yields a deadline', estimated.deadline === '',
  'THE expensive bug: last season\'s date reaching a tracker or an alert');
ok('estimated is labelled as last season', estimated.short.includes('last season'));
ok('estimated explains itself', (estimated.caveat ?? '').includes("last season's dates"));

const real = describeDates(entry({ final_deadline: '2027-05-09' }));
ok('a real deadline passes through', real.deadline === '2027-05-09' && real.caveat === null);

const noDate = describeDates(entry({}));
ok('no dates at all says TBA', noDate.short === 'Dates TBA' && noDate.deadline === '');

const fromTiers = describeDates(entry({ deadlines: [
  { label: 'Early', date: '2027-01-01' }, { label: 'Final', date: '2027-02-01' }] }));
ok('falls back to the last deadline tier', fromTiers.deadline === '2027-02-01');

// ─── fees ────────────────────────────────────────────────────────────────────
ok('fee_min_usd wins', lowestFee(entry({ fee_min_usd: 25 })) === 25);
ok('falls back to the cheapest tier', lowestFee(entry({ deadlines: [
  { label: 'a', date: '2027-01-01', fee: 60 }, { label: 'b', date: '2027-02-01', fee: 40 }] })) === 40);
ok('unknown fee is null, not zero', lowestFee(entry({})) === null,
  'zero would read as "free" and quietly lie about the price');

// ─── filters ─────────────────────────────────────────────────────────────────
const f = { ...EMPTY_FILTERS };
ok('empty filters match everything', matches(entry({}), f));
ok('type filter', !matches(entry({ type: 'fund' }), { ...f, type: 'festival' }));
ok('oscar filter', !matches(entry({}), { ...f, qualifying: 'oscar' })
  && matches(entry({ oscar: true }), { ...f, qualifying: 'oscar' }));
ok('free filter excludes paid', !matches(entry({ fee_min_usd: 10 }), { ...f, maxFee: 'free' }));
ok('free filter includes free', matches(entry({ fee_min_usd: 0 }), { ...f, maxFee: 'free' }));
ok('a fee cap is inclusive', matches(entry({ fee_min_usd: 50 }), { ...f, maxFee: 50 }));
ok('unknown fee fails a fee filter', !matches(entry({}), { ...f, maxFee: 100 }),
  'a surprise entry fee is worse than a missing row');
ok('search covers city', matches(entry({ city: 'Park City' }), { ...f, query: 'park' }));
ok('search is case-insensitive', matches(entry({ name: 'Sundance' }), { ...f, query: 'SUNDANCE' }));
ok('search rejects a miss', !matches(entry({ name: 'Sundance' }), { ...f, query: 'berlin' }));

// ─── deadline arithmetic ─────────────────────────────────────────────────────
const now = new Date('2026-10-15T12:00:00');
ok('7-day alert lands 7 days before', fireDateFor('2026-11-01', 7, now)?.toISOString().slice(0, 10) === '2026-10-25');
ok('alerts in the past are dropped', fireDateFor('2026-10-16', 7, now) === null,
  'scheduling into the past fires immediately, which looks like a bug to the user');
ok('a junk date schedules nothing', fireDateFor('', 7, now) === null && fireDateFor('soon', 1, now) === null);
ok('daysUntil counts whole days', daysUntil('2026-10-22', now) === 7);
ok('daysUntil is negative once past', (daysUntil('2026-10-01', now) ?? 0) < 0);
ok('two leads per festival', identifiersFor('abc').length === LEAD_DAYS.length);
ok('identifiers are unique per festival', identifiersFor('abc')[0] !== identifiersFor('abd')[0]);

const sub = (o: Partial<FestivalSubmission>): FestivalSubmission => ({
  id: '1', projectId: 'p', festivalName: 'F', location: '', deadline: '', submissionDate: '',
  fee: 0, status: 'researching', category: '', platformUrl: '', notes: '', notificationDate: '', ...o });
const soon = closingWithin([
  sub({ id: 'a', deadline: '2026-10-18' }),
  sub({ id: 'b', deadline: '2026-11-30' }),
  sub({ id: 'c', deadline: '2026-10-16' }),
  sub({ id: 'd', deadline: '2026-10-17', status: 'submitted' }),
], 7, now);
ok('closingWithin keeps only the near ones', soon.map(s => s.id).join(',') === 'c,a');
ok('closingWithin sorts soonest first', soon[0].id === 'c');
ok('already submitted is not a deadline', !soon.some(s => s.id === 'd'),
  'nothing downstream of submitting needs a reminder to submit');

// ─── the shipped snapshot is real ────────────────────────────────────────────
const cat = SNAPSHOT as { built: string; festivals: CatalogEntry[] };
ok('a snapshot ships with the build', cat.festivals.length > 2000,
  `expected thousands of listings, got ${cat.festivals.length}`);
ok('the snapshot knows when it was built', /^\d{4}-\d{2}-\d{2}$/.test(cat.built));
ok('every listing has an id and a name', cat.festivals.every(x => x.id && x.name));
ok('categories are discoverable', categoriesOf(cat.festivals).length > 5);
ok('regions are discoverable', regionsOf(cat.festivals).length > 3);
const estimatedCount = cat.festivals.filter(x => x.estimated).length;
ok('the snapshot still carries the estimated flag', estimatedCount > 100,
  `${estimatedCount} estimated listings; if this hits zero the honesty rules are dead code`);
ok('no estimated listing yields a deadline',
  cat.festivals.filter(x => x.estimated).every(x => describeDates(x).deadline === ''));

// ─── the link out, which is the only answer for 1,969 listings ───────────────
ok('a plain https site passes through', safeSiteUrl('https://sundance.org') === 'https://sundance.org');
ok('http is allowed', safeSiteUrl('http://example.org/submit') === 'http://example.org/submit');
ok('a bare host gets https', safeSiteUrl('festivals.page4films.com') === 'https://festivals.page4films.com');
ok('javascript: is refused', safeSiteUrl('javascript:alert(1)') === null,
  'the catalog is downloaded at runtime and this value reaches Linking.openURL');
ok('a store deep link is refused', safeSiteUrl('itms-apps://apps.apple.com/app/id1') === null);
ok('tel: is refused', safeSiteUrl('tel:+15551234567') === null);
ok('a scheme-relative URL is refused', safeSiteUrl('//evil.example') === null);
ok('a bare word is not a host', safeSiteUrl('ask the programmer') === null);
ok('a hostless string is refused', safeSiteUrl('https://') === null);
ok('empty and missing are refused', safeSiteUrl('') === null && safeSiteUrl(undefined) === null
  && safeSiteUrl(null) === null);
ok('whitespace is trimmed', safeSiteUrl('  https://a.example  ') === 'https://a.example');
ok('credentials in the host are refused', safeSiteUrl('https://user@evil.example') === null);
ok('siteHost drops the scheme, www and path',
  siteHost('https://www.Sundance.org/festival/submit') === 'sundance.org');
ok('siteHost refuses what safeSiteUrl refuses', siteHost('javascript:void 0') === null);
ok('every listing in the snapshot has an openable site',
  cat.festivals.every(x => safeSiteUrl(x.website) !== null),
  'a dateless row with no link is a dead end for the director');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
