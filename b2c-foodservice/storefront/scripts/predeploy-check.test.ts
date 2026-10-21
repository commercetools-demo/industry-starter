import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPredeploy } from './predeploy-check.mjs';

describe('deploy gate', () => {
  it('Deploy gate fails while app/api/health/route.ts exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'predeploy-'));
    mkdirSync(join(root, 'app', 'api', 'health'), { recursive: true });
    writeFileSync(join(root, 'app', 'api', 'health', 'route.ts'), 'export {};\n');
    expect(checkPredeploy(root)).toEqual(['Remove app/api/health/route.ts before deploying']);
  });

  it('Deploy gate passes when the route is removed', () => {
    const root = mkdtempSync(join(tmpdir(), 'predeploy-'));
    mkdirSync(join(root, 'app', 'api'), { recursive: true });
    expect(checkPredeploy(root)).toEqual([]);
  });
});
