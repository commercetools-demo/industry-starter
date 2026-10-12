import { describe, expect, it } from 'vitest';
import { checkRoutes, parseRoutes } from './check-routes.mjs';

const TABLE = `Route (app)
┌ ○ /_not-found
├ ● /[locale]
└ ƒ /dev/tokens
`;

describe('Route gate', () => {
  it('parses the route table', () => {
    expect(parseRoutes(TABLE).map((r) => r.route)).toEqual(['/_not-found', '/[locale]', '/dev/tokens']);
  });
  it('fails on a /dev route in the build output', () => {
    expect(checkRoutes(TABLE).join('')).toMatch(/route \/dev\/tokens must not be part of a build/);
  });
  it('passes on a clean table', () => {
    expect(checkRoutes('┌ ○ /_not-found\n└ ● /[locale]\n')).toEqual([]);
  });
});
