import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import type { ReasonCode } from '@/lib/types';

// Codes owned by J. K's codes (HELD_SERVICE_CONFLICT, NOT_ELIGIBLE_*, NOT_STARTED, ENDED, NOT_SERVICEABLE) get their keys in K.
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

describe('offers.reason messages', () => {
  it.each([
    ['en-US', enUS],
    ['de-DE', deDE],
  ])('has a non-empty message for every J reason code in %s', (_locale, messages) => {
    const reasons = (messages as { offers: { reason: Record<string, string> } }).offers.reason;
    for (const code of J_CODES) expect(reasons[code], code).toBeTruthy();
  });

  it('uses the same ICU parameters in both locales', () => {
    const params = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    const en = (enUS as { offers: { reason: Record<string, string> } }).offers.reason;
    const de = (deDE as { offers: { reason: Record<string, string> } }).offers.reason;
    for (const code of J_CODES) expect(params(de[code]), code).toEqual(params(en[code]));
  });
});
