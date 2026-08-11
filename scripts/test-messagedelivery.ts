/**
 * scripts/test-messagedelivery.ts
 *
 *   bun scripts/test-messagedelivery.ts
 *
 * Who a crew message actually reaches.
 *
 * ## Why this is the suite that matters for #42
 *
 * The Comms Hub sent nothing at all, so its recipient list had never been
 * resolved against anything and two bugs sat in it undetected:
 *
 * - **"Post" matched no department.** The label is "Post"; the enum value is
 *   `postProduction`. Addressed to Post, a message resolved to nobody.
 * - **Direction was not offered**, so a director could not address their own
 *   department.
 *
 * Neither could fail while nothing sent. The moment something does, they stop
 * being cosmetic and become "the safety notice went to nobody" — which is the
 * exact failure the issue says is worse than having no tool.
 *
 * So the resolver is pure and this suite is where it is proved: silence must be
 * impossible to mistake for success, and anyone who cannot be reached has to
 * come back named rather than be dropped.
 */
import {
  RECIPIENT_LABELS, ALL_DEPARTMENTS, departmentForLabel, resolveAudience,
  composeBody, phoneNumbers, emailAddresses, mailtoUrl, describeAudience,
  type Contactable,
} from '@/utils/messageDelivery';
import type { Department } from '@/types';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const person = (id: string, name: string, department: Department,
  phone?: string, email?: string): Contactable => ({ id, name, department, phone, email });

const CREW: Contactable[] = [
  person('c1', 'Nia Okafor', 'camera', '555-0101', 'nia@example.com'),
  person('c2', 'Ross Vane', 'camera', '555-0102'),
  person('c3', 'Dana Whitfield', 'production', undefined, 'dana@example.com'),
  person('c4', 'Kel Moss', 'sound'),                       // reachable by neither
  person('c5', 'Ari Blum', 'postProduction', '555-0105'),
  person('c6', 'Simon Shih', 'direction', '555-0106', 'simon@example.com'),
];

// ─── The mapping that was broken ────────────────────────────────────────────

ok('every offered label maps to a department',
  RECIPIENT_LABELS.every(r => departmentForLabel(r.label) === r.department));

/* The two specific defects, named so a regression says which one came back. */
ok('"Post" maps to postProduction, which it did not', departmentForLabel('Post') === 'postProduction');
ok('Direction is offered at all, which it was not',
  RECIPIENT_LABELS.some(r => r.department === 'direction'));

ok('every department in the enum is addressable', (() => {
  const all: Department[] = ['direction', 'camera', 'sound', 'art', 'lighting',
    'production', 'talent', 'postProduction'];
  return all.every(d => RECIPIENT_LABELS.some(r => r.department === d));
})());

ok('labels are matched case-insensitively', departmentForLabel('camera') === 'camera');
ok('surrounding space does not break a label', departmentForLabel('  Sound ') === 'sound');
ok('the enum value itself is tolerated', departmentForLabel('postProduction') === 'postProduction');
ok('an unknown label resolves to null, not a guess', departmentForLabel('Catering') === null);
ok('an empty label resolves to null', departmentForLabel('') === null);

// ─── Resolving an audience ──────────────────────────────────────────────────

const camera = resolveAudience(['Camera'], CREW);
ok('a department reaches only its own people', camera.people.map(p => p.id).join() === 'c1,c2');
ok('someone with a number is reachable by text', camera.withPhone.length === 2);
ok('someone without an address is not counted for email', camera.withEmail.map(p => p.id).join() === 'c1');

const everyone = resolveAudience([ALL_DEPARTMENTS], CREW);
ok('All Departments reaches the whole crew', everyone.people.length === CREW.length);
ok('All Departments ignores any other label alongside it',
  resolveAudience([ALL_DEPARTMENTS, 'Camera'], CREW).people.length === CREW.length);

const two = resolveAudience(['Camera', 'Sound'], CREW);
ok('two departments combine', two.people.map(p => p.id).join() === 'c1,c2,c4');

/* The bug this suite exists for: before the mapping, this was empty. */
const post = resolveAudience(['Post'], CREW);
ok('a message to Post now reaches post-production', post.people.map(p => p.id).join() === 'c5');
ok('a message to Post is not silently empty', post.people.length > 0);

const direction = resolveAudience(['Direction'], CREW);
ok('a director can address their own department', direction.people.map(p => p.id).join() === 'c6');

// ─── Nobody is silently dropped ─────────────────────────────────────────────

ok('someone with neither number nor address comes back named',
  two.unreachable.map(p => p.name).join() === 'Kel Moss');
ok('the unreachable are still counted as addressed',
  two.people.length === two.withPhone.length + 1);

const nonsense = resolveAudience(['Catering', 'Camera'], CREW);
ok('an unmatched label is reported rather than ignored',
  nonsense.unknownLabels.join() === 'Catering');
ok('an unmatched label does not stop the rest resolving', nonsense.people.length === 2);

ok('a department with nobody in it resolves to nobody, not an error',
  resolveAudience(['Art'], CREW).people.length === 0);
ok('an empty crew resolves to nobody', resolveAudience([ALL_DEPARTMENTS], []).people.length === 0);
ok('no recipients resolves to nobody', resolveAudience([], CREW).people.length === 0);

/* The same person assigned twice must arrive once, not be texted twice. */
ok('a duplicated contact is deduplicated',
  resolveAudience([ALL_DEPARTMENTS], [...CREW, CREW[0]]).people.length === CREW.length);

// ─── What actually gets sent ────────────────────────────────────────────────

ok('a safety message says so in the body a crew member sees',
  composeBody({ subject: 'Wet floors', body: 'Stage B', category: 'safety' })
    .startsWith('SAFETY — Wet floors'));
ok('an urgent message says so', composeBody({ subject: 'Move', body: 'Now', priority: 'urgent' })
  .startsWith('URGENT — Move'));
ok('safety wins over urgent, rather than printing both',
  composeBody({ subject: 'X', body: 'y', priority: 'urgent', category: 'safety' })
    .startsWith('SAFETY — '));
ok('a normal message is unprefixed',
  composeBody({ subject: 'Lunch', body: 'Back at 2' }) === 'Lunch\n\nBack at 2');
ok('an empty body does not leave trailing blank lines',
  composeBody({ subject: 'Wrap', body: '' }) === 'Wrap');

ok('phone numbers come out in crew order', phoneNumbers(two).join() === '555-0101,555-0102');
ok('email addresses skip anyone without one', emailAddresses(everyone).join() ===
  'nia@example.com,dana@example.com,simon@example.com');

const url = mailtoUrl(['a@x.com', 'b@y.com'], 'SAFETY — Wet floors', 'Stage B & the stair unit');
ok('mailto carries every recipient', url.startsWith('mailto:a%40x.com,b%40y.com?'));
ok('mailto encodes the subject', url.includes('subject=SAFETY%20%E2%80%94%20Wet%20floors'));
ok('mailto encodes an ampersand in the body, which would truncate it',
  url.includes('Stage%20B%20%26%20the%20stair%20unit'));

// ─── What the director is told before anything opens ────────────────────────

ok('the summary leads with who is actually reached',
  describeAudience(two, 'text').startsWith('2 of 3 addressed'));
ok('the summary names how many are being left out',
  describeAudience(two, 'text').includes('1 have no phone number'));
ok('a fully reachable audience says so',
  describeAudience(resolveAudience(['Camera'], CREW), 'text').includes('Everyone has a phone number'));
ok('nobody reachable is stated plainly rather than shown as zero',
  describeAudience(resolveAudience(['Sound'], CREW), 'text')
    .includes('None of the 1 people addressed'));
ok('an empty department says nobody is in it',
  describeAudience(resolveAudience(['Art'], CREW), 'text')
    .includes('Nobody on this film is in those departments'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
