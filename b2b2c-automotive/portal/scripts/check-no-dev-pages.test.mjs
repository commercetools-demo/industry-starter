import { describe, expect, it } from 'vitest';
import { checkNoDevPages } from './check-no-dev-pages.mjs';
import { tmp } from './test-utils.mjs';

describe('Dev page in a release build', () => {
  it('Dev page in a release build fails when it uses a production page extension', () => {
    const problems = checkNoDevPages(tmp({ 'app/dev/tokens/page.tsx': 'export {};' }));
    expect(problems.join('')).toMatch(/app\/dev\/tokens\/page\.tsx: a dev route must be named page\.dev\.tsx/);
  });
  it('passes for .dev.tsx pages, which production builds do not register', () => {
    expect(checkNoDevPages(tmp({ 'app/dev/tokens/page.dev.tsx': 'export {};', 'app/[locale]/page.tsx': 'export {};' }))).toEqual([]);
  });
});
