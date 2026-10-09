import 'server-only';
import { unstable_cache } from 'next/cache';
import { apiRoot } from '@/lib/ct/client';

/** Public project configuration: identical for every visitor, so it may be cached. */
export interface ProjectSettings {
  countries: string[];
  currencies: string[];
  languages: string[];
}

/** TTL (seconds) of the project settings cache. */
export const PROJECT_SETTINGS_REVALIDATE_SECONDS = 300;

async function fetchProjectSettings(): Promise<ProjectSettings> {
  const { body } = await apiRoot.get().execute();
  return {
    countries: [...(body.countries ?? [])],
    currencies: [...(body.currencies ?? [])],
    languages: [...(body.languages ?? [])],
  };
}

/** Countries, currencies and languages enabled in the commercetools project (cached 300 s). */
export const getProjectSettings = unstable_cache(fetchProjectSettings, ['ct-project-settings'], {
  revalidate: PROJECT_SETTINGS_REVALIDATE_SECONDS,
});
