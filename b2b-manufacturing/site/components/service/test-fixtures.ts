import { createTranslator } from 'next-intl';
import enMessages from '@/messages/en-US.json';
import deMessages from '@/messages/de-DE.json';
import type { Service } from '@/lib/types';

export const messagesFor = (locale: string) => (locale === 'de-DE' ? deMessages : enMessages);

/** Stand-in for next-intl/server `getTranslations` in page tests. */
export const fakeGetTranslations = async (arg: string | { locale?: string; namespace?: string }) => {
  const { locale = 'en-US', namespace } = typeof arg === 'string' ? { namespace: arg } : arg;
  return createTranslator({ locale, messages: messagesFor(locale) as never, namespace: namespace as never });
};

const PLUMBING = ['Pipe installation & repair', 'Drain cleaning & CCTV survey', 'Backflow & water testing', 'Boiler & hot water', 'Commercial fit-outs'];
const WASTE = ['General waste collection', 'Recycling', 'Hazardous waste', 'Grease trap servicing', 'Medical / clinical waste', 'Liquid waste & tankering', 'Compliance reporting'];
export const slugify = (n: string) => n.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const make = (name: string, category: Service['category'], order: number, over: Partial<Service> = {}): Service => ({
  id: `id-${slugify(name)}`, key: slugify(name), slug: slugify(name), name, summary: `${name}: one sentence description.`, description: `${name}: the long description.`,
  category, sectors: ['facilities', 'manufacturing', 'property', 'healthcare'], frequencies: ['one-off', 'annual'],
  included: ['Item one', 'Item two'], steps: ['Step one', 'Step two', 'Step three'], records: ['Report in the portal'],
  faq: [{ question: `Question for ${name}?`, answer: 'An answer.' }], relatedIds: [], needsWasteDetails: false, order, imageUrl: undefined, ...over,
});

export const plumbingServices = PLUMBING.map((n, i) => make(n, 'plumbing', i + 1));
export const wasteServices = WASTE.map((n, i) => make(n, 'waste-management', i + 1, n === 'Medical / clinical waste' ? { sectors: ['healthcare'] } : n === 'Liquid waste & tankering' ? { sectors: ['manufacturing', 'facilities'] } : {}));
export const allServices = [...plumbingServices, ...wasteServices];
