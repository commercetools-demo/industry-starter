// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === '.next') return [];
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('Isolated review client', () => {
  it('Review creation: only the review module imports the isolated client, and no other module imports it', () => {
    const root = process.cwd();
    const importers = ['app', 'lib', 'components', 'hooks']
      .flatMap((d) => files(join(root, d)))
      .filter((f) => !/\.test\.tsx?$/.test(f) && !f.endsWith('review-client.ts'))
      .filter((f) => /from '@\/lib\/ct\/review-client'|from '\.\/review-client'/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(root.length + 1));
    expect(importers).toEqual(['lib/ct/reviews.ts']);
  });
});
