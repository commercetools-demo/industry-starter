// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Canonical order of `npm run verify` (plan/workstreams/A-scaffold-tooling-verify.md). Later workstreams insert at their position.
const CANONICAL_ORDER = [
  'check:secrets',
  'check:lockfile',
  'check:versions',
  'check:tokens',
  'check:boundaries',
  'lint',
  'typecheck',
  'test',
  'build',
  'check:bundle',
  'check:dev-routes',
] as const;

type PackageJson = { scripts: Record<string, string>; engines?: { node?: string } };

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')) as PackageJson;

function verifySteps(): string[] {
  return pkg.scripts.verify.split('&&').map((part) => {
    const step = part.trim();
    if (step === 'npm test') return 'test';
    const match = /^npm run (\S+)$/.exec(step);
    if (!match) throw new Error(`verify contains a step that is not "npm run <script>": ${step}`);
    return match[1];
  });
}

describe('verify script', () => {
  it('only contains steps from the canonical list', () => {
    for (const step of verifySteps()) {
      expect(CANONICAL_ORDER as readonly string[]).toContain(step);
    }
  });

  it('keeps the present steps in canonical relative order', () => {
    const positions = verifySteps().map((step) => CANONICAL_ORDER.indexOf(step as (typeof CANONICAL_ORDER)[number]));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('starts with check:lockfile until check:secrets is added, then with check:secrets', () => {
    const steps = verifySteps();
    const expectedFirst = steps.includes('check:secrets') ? 'check:secrets' : 'check:lockfile';
    expect(steps[0]).toBe(expectedFirst);
    expect(pkg.scripts.verify.startsWith(`npm run ${expectedFirst}`)).toBe(true);
  });

  it('declares every verify step as a package script and requires node >=22', () => {
    for (const step of verifySteps()) {
      expect(pkg.scripts[step], step).toBeTruthy();
    }
    expect(pkg.engines?.node).toBe('>=22');
  });
});
