import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ enabled: true, open: false }));

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('@ct-demos/demotools/tracker/server', () => ({
  GATE_COOKIE: 'gate',
  isGateEnabled: () => state.enabled,
  isGateOpen: () => state.open,
  gateSlug: () => 'slug',
  trackerOrigin: () => 'https://tracker.example.test',
  siteIsOpen: async () => false,
}));

import { isDemoGateOpen, isPreviewDeployment } from './gate';

afterEach(() => {
  vi.unstubAllEnvs();
  state.enabled = true;
  state.open = false;
});

describe('demo gate', () => {
  it('stays closed for a visitor without the cookie on a gated deployment', async () => {
    expect(await isDemoGateOpen()).toBe(false);
  });

  it('is open on the page-builder preview deployment, where the editor frame carries no cookie', async () => {
    vi.stubEnv('PB_ALLOW_MC_FRAMING', 'true');
    expect(await isDemoGateOpen()).toBe(true);
  });

  it('PB_ALLOW_MC_FRAMING other than true does not open the gate', async () => {
    vi.stubEnv('PB_ALLOW_MC_FRAMING', 'false');
    expect(await isDemoGateOpen()).toBe(false);
    expect(isPreviewDeployment({})).toBe(false);
  });
});
