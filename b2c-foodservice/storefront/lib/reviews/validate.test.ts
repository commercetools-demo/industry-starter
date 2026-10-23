import { describe, expect, it } from 'vitest';
import { authorName, isProductId, sanitizeText, validateReviewInput } from '@/lib/reviews/validate';

describe('review validation', () => {
  it('Missing rating', () => {
    expect(validateReviewInput({ title: 'x' })).toEqual({ ok: false, fields: { rating: 'rating_required' } });
    expect(validateReviewInput({})).toEqual({ ok: false, fields: { rating: 'rating_required' } });
  });

  it('Rating outside 1 to 5 is refused', () => {
    for (const rating of [0, 6, -1, 3.5, '4', NaN]) {
      expect(validateReviewInput({ rating })).toEqual({ ok: false, fields: { rating: 'rating_invalid' } });
    }
    expect(validateReviewInput({ rating: 5 }).ok).toBe(true);
  });

  it('A partial update needs no rating but still checks one when given', () => {
    expect(validateReviewInput({ text: 'ok' }, { partial: true }).ok).toBe(true);
    expect(validateReviewInput({ rating: 9 }, { partial: true }).ok).toBe(false);
  });

  it('Title of 81 characters is refused', () => {
    expect(validateReviewInput({ rating: 3, title: 'a'.repeat(81) })).toEqual({ ok: false, fields: { title: 'title_too_long' } });
    expect(validateReviewInput({ rating: 3, title: 'a'.repeat(80) }).ok).toBe(true);
  });

  it('Text of 2001 characters is refused', () => {
    expect(validateReviewInput({ rating: 3, text: 'a'.repeat(2001) })).toEqual({ ok: false, fields: { text: 'text_too_long' } });
    expect(validateReviewInput({ rating: 3, text: 'a'.repeat(2000) }).ok).toBe(true);
  });

  it('Text keeps markup unchanged', () => {
    const r = validateReviewInput({ rating: 4, text: '<script>alert(1)</script> <b>x</b>' });
    expect(r).toEqual({ ok: true, value: { rating: 4, text: '<script>alert(1)</script> <b>x</b>' } });
  });

  it('Control characters are removed', () => {
    expect(sanitizeText('a\u0000b\u0007c\td\r\ne')).toBe('abc\td\ne');
    expect(sanitizeText('a\n\n\n\n\nb  ')).toBe('a\n\nb');
  });

  it('Author name is first name and last initial', () => {
    expect(authorName('Maya', 'Okonkwo')).toBe('Maya O.');
    expect(authorName('Maya', '')).toBe('Maya');
    expect(authorName('Maya', undefined)).toBe('Maya');
    expect(authorName('x'.repeat(50), 'Lee')).toBe(`${'x'.repeat(30)} L.`);
  });

  it('Author name never contains an email', () => {
    expect(authorName('maya@example.com', 'okonkwo')).not.toContain('@');
    expect(authorName('a@b.c', '@x')).not.toContain('@');
  });

  it('Product id must be a UUID', () => {
    expect(isProductId('3f1c2a9e-7a1b-4c53-9d0e-1a2b3c4d5e6f')).toBe(true);
    expect(isProductId('x" or 1=1')).toBe(false);
    expect(isProductId(undefined)).toBe(false);
  });
});
