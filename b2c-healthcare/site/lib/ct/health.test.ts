// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
const getApiRoot = vi.fn();
vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => getApiRoot() }));

import { checkConnection, tryProjectKey } from './health';

describe('storefront-project-bootstrap: smoke page project key', () => {
  beforeEach(() => {
    execute.mockReset();
    getApiRoot.mockReset();
  });

  it('returns the project key from the project endpoint', async () => {
    getApiRoot.mockReturnValue({ get: () => ({ execute }) });
    execute.mockResolvedValue({ body: { key: 'spec-test-b2c-healthcare' } });
    expect(await checkConnection()).toEqual({ projectKey: 'spec-test-b2c-healthcare' });
    expect(await tryProjectKey()).toBe('spec-test-b2c-healthcare');
  });

  it('missing environment (the client throws on first use): null, no throw', async () => {
    getApiRoot.mockImplementation(() => {
      throw new Error('Missing CTP_CLIENT_SECRET');
    });
    await expect(tryProjectKey()).resolves.toBeNull();
  });

  it('a failing request gives null without detail', async () => {
    getApiRoot.mockReturnValue({ get: () => ({ execute }) });
    execute.mockRejectedValue(new Error('403 secret=abc'));
    await expect(tryProjectKey()).resolves.toBeNull();
  });
});
