import { MIN_PASSWORD_LENGTH } from './min-password';
import { isEmail, isDisposableEmail } from '../validation';
import { CHOICES, COUNTRIES, SECTORS, SITE_COUNTS, WASTE_TYPE_KEYS, type Choice } from './constants';

/** Everything the form collects. The cart carries the services; `choice` and `need` stand in when there are none. */
export interface RequestFields {
  choice: Choice | '';
  need: string;
  company: string;
  sector: string;
  siteId: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
  siteCount: string;
  wasteTypes: string[];
  permitNumber: string;
  contactName: string;
  jobTitle: string;
  email: string;
  phone: string;
  password: string;
}

export const emptyFields = (country = 'US'): RequestFields => ({
  choice: '', need: '', company: '', sector: '', siteId: '', addressLine1: '', addressLine2: '', city: '', postalCode: '', country, siteCount: '', wasteTypes: [], permitNumber: '', contactName: '', jobTitle: '', email: '', phone: '', password: '',
});

/** Error codes; the page maps each to a sentence in the visitor's language (`requestQuote.errors.<code>`). */
export type ErrorCode = 'service' | 'company' | 'sector' | 'addressLine1' | 'city' | 'postalCode' | 'siteCount' | 'contactName' | 'contactNameFull' | 'email' | 'emailWork' | 'passwordShort' | 'passwordCommon' | 'passwordMissing';
export type FieldErrors = Partial<Record<keyof RequestFields, ErrorCode>>;

export interface StepContext { hasServices: boolean; signedIn: boolean }

export const STEP_FIELDS = [['choice'], ['company', 'sector', 'addressLine1', 'city', 'postalCode', 'siteCount'], ['contactName', 'email', 'password']] as const satisfies ReadonlyArray<ReadonlyArray<keyof RequestFields>>;

/** Splits "Ada Lovelace King" into first name and last name (everything before the last word is the first name). */
export function splitName(full: string): { firstName: string; lastName: string } | null {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1]! };
}

export function validateStep(step: 0 | 1 | 2, f: RequestFields, ctx: StepContext): FieldErrors {
  const e: FieldErrors = {};
  if (step === 0 && !ctx.hasServices && !CHOICES.includes(f.choice as Choice)) e.choice = 'service';
  if (step === 1) {
    if (!f.company.trim()) e.company = 'company';
    if (!SECTORS.includes(f.sector as never)) e.sector = 'sector';
    if (!f.addressLine1.trim()) e.addressLine1 = 'addressLine1';
    if (!f.city.trim()) e.city = 'city';
    if (!f.postalCode.trim()) e.postalCode = 'postalCode';
    if (!SITE_COUNTS.includes(f.siteCount as never)) e.siteCount = 'siteCount';
  }
  if (step === 2) {
    if (!f.contactName.trim()) e.contactName = 'contactName';
    else if (!ctx.signedIn && !splitName(f.contactName)) e.contactName = 'contactNameFull';
    if (!isEmail(f.email.trim())) e.email = 'email';
    else if (!ctx.signedIn && isDisposableEmail(f.email.trim())) e.email = 'emailWork';
    if (!ctx.signedIn) {
      if (!f.password) e.password = 'passwordMissing';
      else if (f.password.length < MIN_PASSWORD_LENGTH) e.password = 'passwordShort';
    }
  }
  return e;
}

/** All steps together (the server's view). The first step's service error is keyed `choice`. */
export function validateAll(f: RequestFields, ctx: StepContext): FieldErrors {
  return { ...validateStep(0, f, ctx), ...validateStep(1, f, ctx), ...validateStep(2, f, ctx) };
}

const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Normalises untrusted JSON into RequestFields (unknown keys dropped, strings trimmed and capped). */
export function parseFields(raw: unknown): RequestFields {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const wasteTypes = Array.isArray(r.wasteTypes) ? r.wasteTypes.filter((w): w is string => typeof w === 'string' && WASTE_TYPE_KEYS.includes(w)) : [];
  const country = str(r.country, 2).toUpperCase();
  return {
    choice: (CHOICES as readonly string[]).includes(str(r.choice, 10)) ? (str(r.choice, 10) as Choice) : '',
    need: str(r.need, 1000), company: str(r.company), sector: str(r.sector, 30), siteId: str(r.siteId, 80),
    addressLine1: str(r.addressLine1), addressLine2: str(r.addressLine2), city: str(r.city, 100), postalCode: str(r.postalCode, 20),
    country: (COUNTRIES as readonly string[]).includes(country) ? country : '', siteCount: str(r.siteCount, 20), wasteTypes: [...new Set(wasteTypes)],
    permitNumber: str(r.permitNumber, 100), contactName: str(r.contactName, 200), jobTitle: str(r.jobTitle, 100), email: str(r.email, 254).toLowerCase(), phone: str(r.phone, 40),
    password: typeof r.password === 'string' ? r.password : '',
  };
}
