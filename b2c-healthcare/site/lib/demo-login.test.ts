import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_PATIENTS, demoLoginEnabled, findDemoPatient } from './demo-login';

afterEach(() => vi.unstubAllEnvs());

describe('demo login', () => {
  it('is off without DEMO_LOGIN_PASSWORD or with a short one', () => {
    vi.stubEnv('DEMO_LOGIN_PASSWORD', '');
    expect(demoLoginEnabled()).toBe(false);
    vi.stubEnv('DEMO_LOGIN_PASSWORD', 'short');
    expect(demoLoginEnabled()).toBe(false);
    vi.stubEnv('DEMO_LOGIN_PASSWORD', 'long-enough-pass');
    expect(demoLoginEnabled()).toBe(true);
  });
  it('knows exactly the three synthetic patients and nothing else', () => {
    expect(DEMO_PATIENTS.map((p) => p.email)).toEqual(['sam.rivera@example.com', 'alex.chen@example.com', 'jordan.lee@example.com']);
    expect(findDemoPatient('sam-rivera')?.label).toBe('Sam Rivera');
    expect(findDemoPatient('someone-else')).toBeUndefined();
  });
});
