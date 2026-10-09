export const SECTORS = ['facilities', 'manufacturing', 'property', 'healthcare', 'other'] as const;
export type Sector = (typeof SECTORS)[number];

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DISPOSABLE = /@(mailinator|guerrillamail|10minutemail|tempmail|trashmail|yopmail|sharklasers)\./i;

export const isEmail = (value: string): boolean => EMAIL_PATTERN.test(value) && value.length <= 254;
export const isDisposableEmail = (value: string): boolean => DISPOSABLE.test(value);

/** A same-site path for `?next=`: starts with a single slash, no scheme, no protocol-relative or backslash tricks. */
export function safeNextPath(value: unknown, fallback = '/account'): string {
  const path = safeSamePath(value, fallback);
  // The router adds the locale itself, so a prefix that came with the link is removed.
  return path.replace(/^\/[a-z]{2}-[A-Z]{2}(?=\/|$|\?|#)/, '') || '/';
}

function safeSamePath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'http://site.invalid');
    return url.origin === 'http://site.invalid' ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export interface RegistrationInput {
  companyName: string; sector: Sector; firstName: string; lastName: string; jobTitle: string; email: string; phone: string; password: string;
}

export type FieldErrors = Partial<Record<keyof RegistrationInput, string>>;

const clean = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Normalises raw JSON into a RegistrationInput; field errors name the field. Password strength is checked separately. */
export function parseRegistration(raw: unknown): { input?: RegistrationInput; errors?: FieldErrors } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const input: RegistrationInput = {
    companyName: clean(r.companyName), sector: clean(r.sector) as Sector, firstName: clean(r.firstName, 100), lastName: clean(r.lastName, 100),
    jobTitle: clean(r.jobTitle, 100), email: clean(r.email, 254).toLowerCase(), phone: clean(r.phone, 40), password: typeof r.password === 'string' ? r.password : '',
  };
  const errors: FieldErrors = {};
  if (!input.companyName) errors.companyName = 'Enter your company name.';
  if (!SECTORS.includes(input.sector)) errors.sector = 'Choose a sector.';
  if (!input.firstName) errors.firstName = 'Enter your first name.';
  if (!input.lastName) errors.lastName = 'Enter your last name.';
  if (!isEmail(input.email)) errors.email = 'Enter a valid work email.';
  else if (isDisposableEmail(input.email)) errors.email = 'Use your work email address.';
  if (!input.password) errors.password = 'Enter a password.';
  return Object.keys(errors).length ? { errors } : { input };
}
