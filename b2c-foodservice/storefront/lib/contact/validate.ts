/** Contact form validators. Used by the form and by the route so both agree; no package, no server-only import. */

export const CONTACT_TOPICS = ['order', 'collection', 'subscription', 'product', 'other'] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const LIMITS = {
  name: { min: 2, max: 80 },
  orderNumber: { min: 3, max: 40 },
  message: { min: 10, max: 2000 },
  email: { max: 254 },
} as const;

/** Keys under `contact.error.` in the catalogues. */
export type ContactErrorCode = 'required' | 'emailInvalid' | 'tooShort' | 'tooLong' | 'orderNumberInvalid' | 'consentRequired';
export type ContactField = 'name' | 'email' | 'topic' | 'orderNumber' | 'message' | 'consent';

export interface ContactInput {
  name: string;
  email: string;
  topic: ContactTopic;
  orderNumber: string;
  message: string;
  consent: true;
}

export type ContactErrors = Partial<Record<ContactField, ContactErrorCode>>;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ORDER_NUMBER_SHAPE = /^[A-Za-z0-9-]+$/;

export function isContactTopic(value: unknown): value is ContactTopic {
  return typeof value === 'string' && (CONTACT_TOPICS as readonly string[]).includes(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Returns the cleaned input, or one error code per failing field (never the entered value). */
export function validateContact(
  raw: unknown,
): { ok: true; value: ContactInput } | { ok: false; errors: ContactErrors } {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors: ContactErrors = {};

  const name = text(src.name);
  if (!name) errors.name = 'required';
  else if (name.length < LIMITS.name.min) errors.name = 'tooShort';
  else if (name.length > LIMITS.name.max) errors.name = 'tooLong';

  const email = text(src.email);
  if (!email) errors.email = 'required';
  else if (email.length > LIMITS.email.max || !EMAIL_SHAPE.test(email)) errors.email = 'emailInvalid';

  if (!isContactTopic(src.topic)) errors.topic = 'required';

  const orderNumber = text(src.orderNumber);
  if (orderNumber) {
    if (orderNumber.length < LIMITS.orderNumber.min || orderNumber.length > LIMITS.orderNumber.max || !ORDER_NUMBER_SHAPE.test(orderNumber)) {
      errors.orderNumber = 'orderNumberInvalid';
    }
  }

  const message = text(src.message);
  if (!message) errors.message = 'required';
  else if (message.length < LIMITS.message.min) errors.message = 'tooShort';
  else if (message.length > LIMITS.message.max) errors.message = 'tooLong';

  if (src.consent !== true) errors.consent = 'consentRequired';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, email, topic: src.topic as ContactTopic, orderNumber, message, consent: true } };
}

/** Field order on the form, for focusing the first invalid one. */
export const FIELD_ORDER: ContactField[] = ['name', 'email', 'topic', 'orderNumber', 'message', 'consent'];
