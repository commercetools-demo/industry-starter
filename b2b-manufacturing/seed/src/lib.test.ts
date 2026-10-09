import { describe, expect, it, vi } from 'vitest';
import { assertSafeProject, findOne, parseArgs, readSeedEnv, Runner } from './lib';

const goodEnv = {
  SEED_CTP_PROJECT_KEY: 'malva-demo',
  SEED_CTP_AUTH_URL: 'https://auth.example.test',
  SEED_CTP_API_URL: 'https://api.example.test',
  SEED_CTP_CLIENT_ID: 'id',
  SEED_CTP_CLIENT_SECRET: 'secret',
  SEED_CTP_SCOPES: 'manage_project:malva-demo',
  EXPECTED_PROJECT_KEY: 'malva-demo',
};

describe('readSeedEnv', () => {
  it('returns the typed config', () => {
    expect(readSeedEnv(goodEnv).projectKey).toBe('malva-demo');
  });

  it('names the missing variable and never prints a value', () => {
    for (const name of Object.keys(goodEnv)) {
      const env = { ...goodEnv, [name]: undefined };
      expect(() => readSeedEnv(env)).toThrowError(name);
      expect(() => readSeedEnv(env)).not.toThrowError(/secret$/);
    }
  });
});

describe('assertSafeProject', () => {
  it('accepts a matching key', () => {
    expect(() => assertSafeProject('malva-demo', 'malva-demo')).not.toThrow();
  });

  it('refuses a key that differs from EXPECTED_PROJECT_KEY', () => {
    expect(() => assertSafeProject('other', 'malva-demo')).toThrowError(/mismatch/);
  });

  it('refuses a missing EXPECTED_PROJECT_KEY', () => {
    expect(() => assertSafeProject('malva-demo', undefined)).toThrowError(/EXPECTED_PROJECT_KEY/);
  });

  it('always refuses the healthcare project, even when both keys match', () => {
    expect(() => assertSafeProject('spec-test-b2c-healthcare', 'spec-test-b2c-healthcare')).toThrowError(/another team/);
  });
});

describe('parseArgs', () => {
  it('reads flags', () => {
    expect(parseArgs(['--dry-run', '--only', 'tax', '--count', '3'])).toMatchObject({ dryRun: true, only: 'tax', count: 3 });
  });

  it('bounds --count', () => {
    expect(() => parseArgs(['--count', '0'])).toThrow();
    expect(() => parseArgs(['--count', '7'])).toThrow();
    expect(() => parseArgs(['--count', '1.5'])).toThrow();
  });
});

describe('Runner', () => {
  it('does not run the action in dry-run mode but counts and logs it', async () => {
    const log = vi.fn();
    const fn = vi.fn(async () => 'done');
    const run = new Runner(true, log);
    expect(await run.act('create thing', fn)).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
    expect(run.changes).toBe(1);
    expect(log).toHaveBeenCalledWith('would create thing');
  });

  it('runs the action otherwise', async () => {
    const fn = vi.fn(async () => 'done');
    const run = new Runner(false, () => undefined);
    expect(await run.act('create thing', fn)).toBe('done');
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('findOne', () => {
  it('returns undefined on 404', async () => {
    expect(await findOne(async () => { throw Object.assign(new Error('nf'), { statusCode: 404 }); })).toBeUndefined();
  });

  it('rethrows other errors', async () => {
    await expect(findOne(async () => { throw Object.assign(new Error('boom'), { statusCode: 500 }); })).rejects.toThrow('boom');
  });

  it('returns the body on success', async () => {
    expect(await findOne(async () => ({ body: { id: 1 } }))).toEqual({ id: 1 });
  });
});
