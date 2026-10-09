import type { Attribute, ProductProjection } from '@commercetools/platform-sdk';
import type { Service } from '../types';
import { getLocalizedString } from '../utils';

type L = Record<string, string> | undefined;
const attr = (attrs: Attribute[] | undefined, name: string): unknown => attrs?.find((a) => a.name === name)?.value;
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const enumKeys = (v: unknown): string[] => list<string | { key: string }>(v).map((x) => (typeof x === 'string' ? x : x.key));

/** Map a service projection to the app type. No price is read: services are quoted, not sold at a listed price. */
export function mapService(p: ProductProjection, locale: string): Service {
  const a = p.masterVariant.attributes;
  const t = (v: unknown) => getLocalizedString(v as L, locale);
  const faq = list<Array<{ name: string; value: unknown }>>(attr(a, 'faq')).map((f) => ({
    question: t(f.find((x) => x.name === 'question')?.value),
    answer: t(f.find((x) => x.name === 'answer')?.value),
  }));
  return {
    id: p.id,
    key: p.key ?? p.id,
    slug: getLocalizedString(p.slug, locale),
    name: getLocalizedString(p.name, locale),
    summary: t(attr(a, 'summary')),
    description: getLocalizedString(p.description, locale),
    category: p.categories.some((c) => c.obj?.key === 'mpw-waste-management') ? 'waste-management' : 'plumbing',
    sectors: enumKeys(attr(a, 'sectors')),
    frequencies: enumKeys(attr(a, 'frequencies')),
    included: list(attr(a, 'included')).map(t),
    steps: list(attr(a, 'steps')).map(t),
    records: list(attr(a, 'records')).map(t),
    faq,
    relatedIds: list<{ id: string }>(attr(a, 'related')).map((r) => r.id),
    needsWasteDetails: attr(a, 'needs-waste-details') === true,
    order: Number(attr(a, 'display-order') ?? 0),
    imageUrl: p.masterVariant.images?.[0]?.url,
  };
}
