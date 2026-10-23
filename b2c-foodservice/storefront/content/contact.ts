import type { Localized } from '@/lib/content/localized';

export interface ContactChannel {
  label: Localized<string>;
  email: string;
  phone: string | null;
  hours: Localized<string>;
  replyWithin: Localized<string>;
}

// DRAFT: placeholder channels on the .example domain. The owner supplies real values (SO-P3).
const DEFAULT_CHANNEL: ContactChannel = {
  label: { 'en-US': 'Customer care' },
  email: 'care@malva-coffee.example',
  phone: '+1 212 555 0100',
  hours: { 'en-US': 'Monday to Friday, 9 am to 6 pm Eastern Time' },
  replyWithin: { 'en-US': 'one business day' },
};

const CANADA_CHANNEL: ContactChannel = {
  label: { 'en-US': 'Customer care (Canada)' },
  email: 'care-ca@malva-coffee.example',
  phone: '+1 416 555 0100',
  hours: { 'en-US': 'Monday to Friday, 9 am to 5 pm Eastern Time' },
  replyWithin: { 'en-US': 'two business days' },
};

export const CONTACT: { default: ContactChannel; byCountry: Partial<Record<'US' | 'CA', ContactChannel>> } = {
  default: DEFAULT_CHANNEL,
  byCountry: { US: DEFAULT_CHANNEL, CA: CANADA_CHANNEL },
};

/** `byCountry[country] ?? default`: a market without its own entry sees the default channels, never an empty block. */
export function channelFor(country: string | undefined, contact = CONTACT): ContactChannel {
  const entry = country === 'US' || country === 'CA' ? contact.byCountry[country] : undefined;
  return entry ?? contact.default;
}
