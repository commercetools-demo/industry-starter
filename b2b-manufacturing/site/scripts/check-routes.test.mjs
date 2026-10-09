// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dynamicPublicRoutes } from './check-routes.mjs';

const fixture = (n) => readFileSync(path.join(process.cwd(), 'scripts/fixtures', n), 'utf8');
describe('malva-data-loading › Layout without session (build output)', () => {
  it('static and revalidated public routes pass; portal and API may be dynamic', () => { expect(dynamicPublicRoutes(fixture('build-ok.txt'))).toEqual([]); });
  it('a dynamic homepage fails the check', () => { expect(dynamicPublicRoutes(fixture('build-dynamic-home.txt'))).toEqual(['/[locale]']); });
});
