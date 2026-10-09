import 'server-only';
import { cache } from 'react';
import type { Category as CtCategory, ProductProjection, ProductSearchRequest } from '@commercetools/platform-sdk';
import { COUNTRY_CONFIG } from '../utils';
import { mapService } from '../mappers/service';
import type { Category, Service } from '../types';
import { apiRoot } from './client';

export const CATEGORY_KEYS = { plumbing: 'mpw-plumbing', 'waste-management': 'mpw-waste-management' } as const;
export type CategorySlug = keyof typeof CATEGORY_KEYS;

const storeKey = () => process.env.CTP_DEFAULT_STORE_KEY ?? 'mpw-web';

export interface ServiceQuery { locale: string; categoryId?: string; sector?: string; slug?: string; limit?: number }

/** One Product Search call, scoped to the default store through its Product Selection. Never the deprecated projections search endpoint. */
export function buildSearchRequest({ locale, categoryId, sector, slug, limit = 50 }: ServiceQuery): ProductSearchRequest {
  const config = COUNTRY_CONFIG[locale];
  if (!config) throw new Error(`Unsupported locale "${locale}"`);
  const and: NonNullable<ProductSearchRequest['query']>[] = [];
  if (categoryId) and.push({ exact: { field: 'categoriesSubTree', value: categoryId } });
  if (sector) and.push({ exact: { field: 'variants.attributes.sectors.key', fieldType: 'enum', value: sector } });
  if (slug) and.push({ exact: { field: 'slug', language: locale, value: slug } });
  return {
    ...(and.length ? { query: and.length === 1 ? and[0] : { and } } : {}),
    productProjectionParameters: { storeProjection: storeKey(), priceCurrency: config.currency, priceCountry: config.country, localeProjection: [locale], expand: ['categories[*]'] },
    limit,
  };
}

const byDisplayOrder = (a: Service, b: Service) => a.order - b.order || a.name.localeCompare(b.name);

async function searchServices(query: ServiceQuery): Promise<Service[]> {
  const { body } = await apiRoot.products().search().post({ body: buildSearchRequest(query) }).execute();
  return body.results.map((r) => r.productProjection).filter((p): p is ProductProjection => Boolean(p)).map((p) => mapService(p, query.locale)).sort(byDisplayOrder);
}

export const mapCategory = (c: CtCategory, locale: string): Category => ({ id: c.id, key: c.key ?? c.id, slug: c.slug[locale] ?? Object.values(c.slug)[0] ?? '', name: c.name[locale] ?? Object.values(c.name)[0] ?? '' });

/** The category tree is public and stable (cached 60 s by lib/ct/cached.ts). Not per-visitor. */
export async function fetchCategories(locale: string): Promise<Category[]> {
  const { body } = await apiRoot.categories().get({ queryArgs: { limit: 100, sort: 'orderHint asc' } }).execute();
  return body.results.map((c) => mapCategory(c, locale));
}

export async function fetchServicesByCategory(categorySlug: CategorySlug, locale: string, options: { sector?: string } = {}): Promise<Service[]> {
  const category = await apiRoot.categories().withKey({ key: CATEGORY_KEYS[categorySlug] }).get().execute();
  return searchServices({ locale, categoryId: category.body.id, sector: options.sector });
}

export const fetchAllServices = (locale: string): Promise<Service[]> => searchServices({ locale });

/** `cache()` so `generateMetadata` and the page share one commercetools call per request. */
export const getServiceBySlug = cache(async (slug: string, locale: string): Promise<Service | null> => (await searchServices({ locale, slug, limit: 1 }))[0] ?? null);

export async function getRelatedServices(service: Service, locale: string): Promise<Service[]> {
  if (service.relatedIds.length === 0) return [];
  const all = await getAllServices(locale);
  return service.relatedIds.map((id) => all.find((s) => s.id === id)).filter((s): s is Service => Boolean(s));
}

export const getAllServices = cache((locale: string) => fetchAllServices(locale));
export const getServicesByCategory = cache((categorySlug: CategorySlug, locale: string, sector?: string) => fetchServicesByCategory(categorySlug, locale, { sector }));
