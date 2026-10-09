import { SECTORS } from '../validation';

export { SECTORS };
/** Number-of-sites choices; the keys are the values of the `siteCount` field of the quote request type. */
export const SITE_COUNTS = ['1', '2-10', '11-50', '50-plus'] as const;
export type SiteCount = (typeof SITE_COUNTS)[number];

/** What a visitor with an empty list says they need. "unsure" is the fallback when services are chosen. */
export const CHOICES = ['plumbing', 'waste', 'both', 'unsure'] as const;
export type Choice = (typeof CHOICES)[number];

/** Optional waste types for hazardous, clinical and liquid waste requests. The English label is what the commercial team reads. */
export const WASTE_TYPES = [
  { key: 'hazardous', label: 'Hazardous waste' },
  { key: 'clinical', label: 'Medical / clinical waste' },
  { key: 'liquid', label: 'Liquid waste' },
  { key: 'chemical', label: 'Chemical waste' },
  { key: 'sharps', label: 'Sharps' },
  { key: 'other', label: 'Other' },
] as const;
export const WASTE_TYPE_KEYS: string[] = WASTE_TYPES.map((w) => w.key);

export const COUNTRIES = ['US', 'DE'] as const;
export const REFERENCE_PATTERN = /^MQ-[0-9A-HJKMNP-TV-Z]{6}$/;
export const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
/** Name of the honeypot field: real visitors never see or fill it. */
export const HONEYPOT = 'website';

/** Short-lived cookie telling the quote-list page to show the "started again in the new currency" notice. It holds no data. */
export const QUOTE_LIST_NOTICE_COOKIE = 'malva-ql-notice';
