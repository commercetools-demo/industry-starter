/**
 * Booking contact validation, shared by the confirm modal (client) and `POST /api/bookings` (server) so both
 * give the same verdict. Pure: it never logs and never echoes a value; problems are codes.
 */
export const MAX_REASON_LENGTH = 500;
export const MAX_NAME_LENGTH = 120;
export const MAX_EMAIL_LENGTH = 254;

export type BookingField = 'name' | 'email' | 'phone' | 'reason';
export type BookingProblem =
  | 'nameRequired'
  | 'emailRequired'
  | 'emailInvalid'
  | 'phoneRequired'
  | 'phoneInvalid'
  | 'reasonRequired'
  | 'reasonTooLong';
export type BookingProblems = Partial<Record<BookingField, BookingProblem>>;

export interface BookingContact {
  name?: string;
  email?: string;
  phone?: string;
  reason?: string;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_CHARS = /^[\d\s().+-]+$/;

/**
 * Checks the fields the visitor must give: phone and reason always; name and email only for a guest
 * (a signed-in patient's name and email come from the account).
 */
export function validateBookingContact(contact: BookingContact, { guest }: { guest: boolean }): BookingProblems {
  const problems: BookingProblems = {};
  if (guest) {
    const name = (contact.name ?? '').trim();
    if (!name || name.length > MAX_NAME_LENGTH) problems.name = 'nameRequired';
    const email = (contact.email ?? '').trim();
    if (!email) problems.email = 'emailRequired';
    else if (!EMAIL.test(email) || email.length > MAX_EMAIL_LENGTH) problems.email = 'emailInvalid';
  }
  const phone = (contact.phone ?? '').trim();
  if (!phone) problems.phone = 'phoneRequired';
  else if (!PHONE_CHARS.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15) problems.phone = 'phoneInvalid';
  const reason = (contact.reason ?? '').trim();
  if (!reason) problems.reason = 'reasonRequired';
  else if (reason.length > MAX_REASON_LENGTH) problems.reason = 'reasonTooLong';
  return problems;
}
