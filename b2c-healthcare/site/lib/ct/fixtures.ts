import 'server-only';

/**
 * Development-only data switch (`MALVA_FIXTURES=1`): the doctor list and the search page read the seed data
 * instead of commercetools, so the UI can be checked in a browser without credentials. Never active when
 * NODE_ENV is `production`. The loader keeps the seed data out of production bundles: the literal NODE_ENV
 * test lets the bundler drop the dynamic import there.
 */
export function fixturesEnabled(): boolean {
  return process.env.MALVA_FIXTURES === '1' && process.env.NODE_ENV !== 'production';
}

export type Fixtures = typeof import('./doctors-fixtures');

export async function loadFixtures(): Promise<Fixtures | null> {
  if (process.env.NODE_ENV === 'production' || process.env.MALVA_FIXTURES !== '1') return null;
  return import('./doctors-fixtures');
}
