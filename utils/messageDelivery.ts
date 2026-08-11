/**
 * utils/messageDelivery.ts
 *
 * Turning "Camera, Sound" into the phone numbers and addresses of the people
 * who are actually on this film.
 *
 * ## What was wrong
 *
 * The Comms Hub presented itself as a crew broadcast tool — recipients, an
 * urgent priority, a safety category, "Send quick updates to your crew" — and
 * sent nothing anywhere. It was a private log wearing the clothes of a
 * broadcast tool, which on a set is worse than having no tool: a director who
 * believes a safety notice went out is the actual hazard (#42).
 *
 * ## The mapping bug underneath it
 *
 * `recipients` is stored as display labels — "All Departments", "Camera",
 * "Post" — chosen from a fixed list. `CrewMember.department` is an enum:
 * 'direction' | 'camera' | 'sound' | 'art' | 'lighting' | 'production' |
 * 'talent' | 'postProduction'. Those two lists never agreed:
 *
 * - **"Post" matched nothing.** The enum value is `postProduction`, so a
 *   message addressed to Post would have resolved to an empty set — silently,
 *   because nothing was resolving anything.
 * - **Direction was not offered at all**, so a director could not address
 *   their own department.
 *
 * Both had been invisible for as long as delivery did not exist. The moment
 * anything actually sends, they become "the safety notice went to nobody".
 *
 * The labels stay as they are, because they are already written into every
 * stored message and changing them would orphan those records. The mapping
 * lives here instead.
 *
 * Pure and dependency-free: this is the part that must be right, so it is the
 * part that is tested without a renderer or a device.
 */
import type { Department } from '@/types';

/** A person as this module needs them — a subset of AssignedCrew. */
export interface Contactable {
  id: string;
  name: string;
  department: Department;
  phone?: string;
  email?: string;
}

/** The label that means everyone, kept in one place rather than typed twice. */
export const ALL_DEPARTMENTS = 'All Departments';

/**
 * Every label the compose screen offers, in the order it offers them, mapped
 * to the enum value it addresses.
 *
 * Direction is included: its absence was a bug, not a decision. "Post" keeps
 * its label — it is what a call sheet says and what is already in stored
 * messages — and maps to `postProduction`.
 */
export const RECIPIENT_LABELS: { label: string; department: Department }[] = [
  { label: 'Direction', department: 'direction' },
  { label: 'Camera', department: 'camera' },
  { label: 'Sound', department: 'sound' },
  { label: 'Lighting', department: 'lighting' },
  { label: 'Art', department: 'art' },
  { label: 'Production', department: 'production' },
  { label: 'Talent', department: 'talent' },
  { label: 'Post', department: 'postProduction' },
];

/**
 * The department a recipient label addresses, or null if it addresses none.
 *
 * Case- and space-insensitive because these strings have been stored by hand
 * for as long as the screen has existed, and a message addressed to "camera"
 * should not silently reach nobody.
 */
export function departmentForLabel(label: string): Department | null {
  const wanted = String(label ?? '').trim().toLowerCase();
  if (!wanted) return null;
  const hit = RECIPIENT_LABELS.find(r => r.label.toLowerCase() === wanted);
  if (hit) return hit.department;
  // Tolerate the enum value itself, which is what a synced record may carry.
  const asEnum = RECIPIENT_LABELS.find(r => r.department.toLowerCase() === wanted);
  return asEnum ? asEnum.department : null;
}

export interface Audience {
  /** Everyone the message is addressed to, deduplicated, in crew order. */
  people: Contactable[];
  /** Addressed and reachable by text. */
  withPhone: Contactable[];
  /** Addressed and reachable by email. */
  withEmail: Contactable[];
  /**
   * Addressed and reachable by neither.
   *
   * Surfaced rather than dropped. Quietly sending to nine of twelve people is
   * the same failure as sending to none, just harder to notice.
   */
  unreachable: Contactable[];
  /**
   * Labels that matched no department at all — "Post" before this module
   * existed. Distinct from a department that simply has nobody in it.
   */
  unknownLabels: string[];
}

const clean = (value: string | undefined): string => String(value ?? '').trim();

/**
 * Who a message reaches, given its recipient labels and the film's crew.
 *
 * "All Departments" means every assigned crew member, not every department in
 * the enum — an empty department has nobody to tell.
 */
export function resolveAudience(recipients: string[], crew: Contactable[]): Audience {
  const labels = (recipients ?? []).map(clean).filter(Boolean);
  const everyone = labels.some(l => l.toLowerCase() === ALL_DEPARTMENTS.toLowerCase());

  const unknownLabels: string[] = [];
  const wanted = new Set<Department>();
  if (!everyone) {
    for (const label of labels) {
      const dept = departmentForLabel(label);
      if (dept === null) unknownLabels.push(label);
      else wanted.add(dept);
    }
  }

  const seen = new Set<string>();
  const people: Contactable[] = [];
  for (const person of crew ?? []) {
    if (!everyone && !wanted.has(person.department)) continue;
    if (seen.has(person.id)) continue;      // the same contact assigned twice
    seen.add(person.id);
    people.push(person);
  }

  return {
    people,
    withPhone: people.filter(p => clean(p.phone).length > 0),
    withEmail: people.filter(p => clean(p.email).length > 0),
    unreachable: people.filter(p => !clean(p.phone) && !clean(p.email)),
    unknownLabels,
  };
}

/**
 * The text of the message as it will arrive.
 *
 * Urgent and safety are marked in the body because that is the only part that
 * survives into someone's Messages app — the category and priority chips are
 * ours, and a crew member sees a text.
 */
export function composeBody(message: {
  subject: string;
  body: string;
  priority?: string;
  category?: string;
}): string {
  const urgent = message.priority === 'urgent';
  const safety = message.category === 'safety';
  const prefix = safety ? 'SAFETY — ' : urgent ? 'URGENT — ' : '';
  const subject = clean(message.subject);
  const body = clean(message.body);
  return body ? `${prefix}${subject}\n\n${body}` : `${prefix}${subject}`;
}

/** Phone numbers for the SMS composer, in crew order, no blanks. */
export function phoneNumbers(audience: Audience): string[] {
  return audience.withPhone.map(p => clean(p.phone));
}

/** Addresses for the mail composer, in crew order, no blanks. */
export function emailAddresses(audience: Audience): string[] {
  return audience.withEmail.map(p => clean(p.email));
}

/**
 * A `mailto:` URL, with recipients and body encoded.
 *
 * Email goes through `Linking` rather than a second native module: `mailto:`
 * handles multiple recipients reliably, which is the thing `sms:` does not,
 * and that is why texting uses expo-sms and this does not.
 */
export function mailtoUrl(addresses: string[], subject: string, body: string): string {
  const to = addresses.map(a => encodeURIComponent(a)).join(',');
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return `mailto:${to}?${q}`;
}

/**
 * A one-line summary of who this will actually reach, for the confirmation
 * shown before anything opens.
 *
 * Deliberately leads with the number, and says the unreachable count out loud
 * rather than leaving the director to compare two lists.
 */
export function describeAudience(audience: Audience, channel: 'text' | 'email'): string {
  const reachable = channel === 'text' ? audience.withPhone : audience.withEmail;
  const missing = audience.people.length - reachable.length;
  const noun = channel === 'text' ? 'phone number' : 'email address';

  if (reachable.length === 0) {
    return audience.people.length === 0
      ? 'Nobody on this film is in those departments yet.'
      : `None of the ${audience.people.length} people addressed have a ${noun} on file.`;
  }
  const head = `${reachable.length} of ${audience.people.length} addressed`;
  return missing === 0
    ? `${head}. Everyone has a ${noun}.`
    : `${head}. ${missing} have no ${noun} and will not be included.`;
}
