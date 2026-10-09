import { BOOKINGS } from './data/bookings';
import { PATIENTS } from './data/patients';

/**
 * Test-environment guard (workstream X-07, spec "Test environment holds nobody real"): the seed imports only synthetic people.
 * Allow-list: emails on `example.com` and phone numbers in the fictional 555-01xx range. Anything else stops the seed before
 * the first write, so a production export pasted into `data/` can never reach the project.
 */
const EMAIL_OK = /^[^\s@]+@example\.com$/i;
const PHONE_OK = /\b555[\s.-]?01\d{2}\b/;

export const isSyntheticEmail = (email: string): boolean => EMAIL_OK.test(email.trim());
export const isSyntheticPhone = (phone: string): boolean => PHONE_OK.test(phone);

export interface SyntheticInput {
  patients: { slug: string; email: string; address: { phone?: string } }[];
  bookings: { reference: string; guest?: { email: string; phone: string }; phone?: string }[];
}

/** Names the offending record and field (never the value) and throws. */
export function assertSynthetic(input: SyntheticInput = { patients: PATIENTS, bookings: BOOKINGS as SyntheticInput['bookings'] }): void {
  const bad: string[] = [];
  for (const p of input.patients) {
    if (!isSyntheticEmail(p.email)) bad.push(`patient ${p.slug}: email is not on example.com`);
    if (p.address.phone && !isSyntheticPhone(p.address.phone)) bad.push(`patient ${p.slug}: phone is not in the 555-01xx range`);
  }
  for (const b of input.bookings) {
    if (b.guest && !isSyntheticEmail(b.guest.email)) bad.push(`booking ${b.reference}: guest email is not on example.com`);
    if (b.guest && !isSyntheticPhone(b.guest.phone)) bad.push(`booking ${b.reference}: guest phone is not in the 555-01xx range`);
    if (b.phone && !isSyntheticPhone(b.phone)) bad.push(`booking ${b.reference}: phone is not in the 555-01xx range`);
  }
  if (bad.length > 0) throw new Error(`Refusing to seed data that is not synthetic:\n  ${bad.join('\n  ')}`);
}
