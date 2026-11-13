// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSessionStore } from './index';
import { encodeSession } from './session-store';

const record = {
  id: 'dev-session-1',
  principal: { userId: 'anon-1' },
  provenance: [] as [string, never][],
  messages: [],
  createdAt: '2026-11-09T00:00:00.000Z',
};

describe('session store in next dev', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('two module instances see the same records (routes do not share a module)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    await getSessionStore().create(record);
    vi.resetModules();
    const again = await import('./index');
    expect(await again.getSessionStore().get('dev-session-1')).not.toBeNull();
    expect(encodeSession(record)).toBeTruthy();
  });
});
