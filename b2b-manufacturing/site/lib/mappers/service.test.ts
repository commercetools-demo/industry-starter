import type { ProductProjection } from '@commercetools/platform-sdk';
import { describe, expect, it } from 'vitest';
import { mapService } from './service';

const projection = {
  id: 'p1', key: 'mpw-drain', slug: { 'en-US': 'drain', 'de-DE': 'abfluss' }, name: { 'en-US': 'Drain', 'de-DE': 'Abfluss' }, description: { 'en-US': 'D' },
  categories: [{ typeId: 'category', id: 'c', obj: { key: 'mpw-waste-management' } }],
  masterVariant: { id: 1, images: [{ url: 'https://images.pexels.com/photos/1/pexels-photo-1.jpeg' }], prices: [{ value: { currencyCode: 'USD', centAmount: 0 } }], attributes: [
    { name: 'summary', value: { 'en-US': 'S', 'de-DE': 'Z' } },
    { name: 'sectors', value: [{ key: 'property' }] }, { name: 'frequencies', value: ['one-off'] },
    { name: 'faq', value: [[{ name: 'question', value: { 'en-US': 'Q' } }, { name: 'answer', value: { 'en-US': 'A' } }]] },
    { name: 'needs-waste-details', value: true }, { name: 'display-order', value: 3 }] },
} as unknown as ProductProjection;

describe('malva-bff-and-session › Services are zero-priced and never show a price', () => {
  it('maps localized fields and has no price field', () => {
    const en = mapService(projection, 'en-US');
    expect(en).toMatchObject({ slug: 'drain', name: 'Drain', summary: 'S', category: 'waste-management', sectors: ['property'], frequencies: ['one-off'], needsWasteDetails: true, order: 3 });
    expect(en.faq).toEqual([{ question: 'Q', answer: 'A' }]);
    expect(Object.keys(en).some((k) => /price/i.test(k))).toBe(false);
    expect(mapService(projection, 'de-DE')).toMatchObject({ slug: 'abfluss', name: 'Abfluss', summary: 'Z' });
  });
});
