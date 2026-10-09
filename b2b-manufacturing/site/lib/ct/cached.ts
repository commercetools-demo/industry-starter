import 'server-only';
import { unstable_cache } from 'next/cache';
import type { Category } from '../types';
import { getSupportedLocales } from './locale-validation';
import { apiRoot } from './client';
import { fetchCategories } from './services';

/** TTL table (README): project configuration 300 s, category tree 60 s. Only stable public data is cached here; never per-visitor data. */
export const TTL = { projectConfig: 300, categoryTree: 60 } as const;

export const getCategoryTree = (locale: string): Promise<Category[]> =>
  unstable_cache(() => fetchCategories(locale), ['category-tree', locale], { revalidate: TTL.categoryTree })();

export const getProjectLocales = () =>
  getSupportedLocales(async () => {
    const { body } = await apiRoot.get().execute();
    return { countries: body.countries, currencies: body.currencies, languages: body.languages };
  });
