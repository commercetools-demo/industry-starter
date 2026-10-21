import { describe, expect, it } from 'vitest';
import enCA from '@/messages/en-CA.json';
import enUS from '@/messages/en-US.json';

const leaves = (value: unknown, prefix = ''): string[] =>
  typeof value === 'object' && value !== null
    ? Object.entries(value).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
    : [prefix];

describe('reviews messages', () => {
  it('Catalogues have the same keys', () => {
    expect(leaves(enCA.reviews).sort()).toEqual(leaves(enUS.reviews).sort());
    expect(leaves(enUS.reviews).length).toBeGreaterThan(40);
  });

  it('en-CA equals en-US for the reviews namespace', () => {
    expect(enCA.reviews).toEqual(enUS.reviews);
  });

  it('every field error code of the validator has a message', () => {
    for (const code of ['rating_required', 'rating_invalid', 'title_too_long', 'text_too_long']) {
      expect(enUS.reviews.errors).toHaveProperty(code);
    }
  });
});
