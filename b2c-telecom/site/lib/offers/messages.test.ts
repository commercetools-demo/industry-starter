import { createTranslator } from 'next-intl';
import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import type { ReasonCode } from '@/lib/types';

// J owns the first group, K the second (eligibility, held services, schedule, serviceability).
const J_CODES: ReasonCode[] = [
  'SPEED_TOO_LOW',
  'TECHNOLOGY_MISMATCH',
  'FAMILY_MISMATCH',
  'ALREADY_INCLUDED',
  'DECLARED_INCOMPATIBLE',
  'EXCLUSIVE_CONFLICT',
  'CATALOG_DATA_INCOMPLETE',
  'OFFER_NOT_FOUND',
  'REQUIRED_EQUIPMENT_MISSING',
  'PARENT_REQUIRED',
  'AMBIGUOUS_PARENT',
  'ALREADY_ATTACHED',
];
const K_CODES: ReasonCode[] = [
  'HELD_SERVICE_CONFLICT',
  'NOT_ELIGIBLE_AUDIENCE',
  'NOT_ELIGIBLE_EXISTING_CUSTOMER',
  'NOT_ELIGIBLE_CHANNEL',
  'NOT_STARTED',
  'ENDED',
  'NOT_SERVICEABLE',
];
const ALL_CODES = [...J_CODES, ...K_CODES];

type Reasons = { offers: { reason: Record<string, string> } };

describe('offers.reason messages', () => {
  it.each([
    ['en-US', enUS],
    ['de-DE', deDE],
  ])('has a non-empty message for every J and K reason code in %s', (_locale, messages) => {
    const reasons = (messages as Reasons).offers.reason;
    for (const code of ALL_CODES) expect(reasons[code], code).toBeTruthy();
  });

  it('uses the same ICU parameters in both locales', () => {
    const params = (text: string) => [...new Set([...text.matchAll(/\{(\w+)[,}]/g)].map((match) => match[1]))].sort();
    const en = (enUS as Reasons).offers.reason;
    const de = (deDE as Reasons).offers.reason;
    for (const code of ALL_CODES) expect(params(de[code]), code).toEqual(params(en[code]));
  });

  it.each([
    ['en-US', enUS, 'is for existing Malva customers', 'is for new customers only'],
    ['de-DE', deDE, 'gilt nur für bestehende Malva-Kunden', 'gilt nur für Neukunden'],
  ] as const)('NOT_ELIGIBLE_EXISTING_CUSTOMER renders both select branches in %s', (locale, messages, existing, other) => {
    const t = createTranslator({ locale, messages: messages as never, namespace: 'offers.reason' as never }) as unknown as (key: string, values: Record<string, string>) => string;
    expect(t('NOT_ELIGIBLE_EXISTING_CUSTOMER', { offerName: 'Cable 500', rule: 'existing' })).toContain(existing);
    expect(t('NOT_ELIGIBLE_EXISTING_CUSTOMER', { offerName: 'Cable 500', rule: 'new' })).toContain(other);
  });
});

describe('serviceability messages', () => {
  it.each([
    ['en-US', enUS],
    ['de-DE', deDE],
  ])('has the notServed, partial, invalid and technology keys in %s', (_locale, messages) => {
    const block = (messages as unknown as { serviceability: { notServed: string; partial: string; invalid: string; tech: Record<string, string> } }).serviceability;
    expect(block.notServed).toContain('{postalCode}');
    expect(block.partial).toContain('{technologies}');
    expect(block.invalid).toBeTruthy();
    expect(Object.keys(block.tech).sort()).toEqual(['cable', 'fixed-wireless', 'mobile']);
  });
});
