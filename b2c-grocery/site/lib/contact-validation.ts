/** Shared by the contact form (client) and POST /api/contact (server). No server-only imports. */
export const CONTACT_TOPICS = ['order', 'delivery', 'product', 'other'] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
const NAME_MAX = 100;
const EMAIL_MAX = 254;

export interface ContactInput {
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
}
export type ContactField = 'name' | 'email' | 'topic' | 'message';
export type ContactErrorCode = 'required' | 'invalidEmail' | 'tooShort' | 'tooLong';
export type ContactErrors = Partial<Record<ContactField, ContactErrorCode>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function validateContact(input: unknown): { ok: true; value: ContactInput } | { ok: false; errors: ContactErrors } {
  const raw = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const name = text(raw.name);
  const email = text(raw.email);
  const message = text(raw.message);
  const topic = CONTACT_TOPICS.find((candidate) => candidate === raw.topic);
  const errors: ContactErrors = {};

  if (!name) errors.name = 'required';
  else if (name.length > NAME_MAX) errors.name = 'tooLong';

  if (!email) errors.email = 'required';
  else if (email.length > EMAIL_MAX || !EMAIL.test(email)) errors.email = 'invalidEmail';

  if (!topic) errors.topic = 'required';

  if (!message) errors.message = 'required';
  else if (message.length < MESSAGE_MIN) errors.message = 'tooShort';
  else if (message.length > MESSAGE_MAX) errors.message = 'tooLong';

  if (Object.keys(errors).length > 0 || !topic) return { ok: false, errors };
  return { ok: true, value: { name, email, topic, message } };
}
