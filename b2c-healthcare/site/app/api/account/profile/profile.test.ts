// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectSanitizedError, expectUnauthenticated } from '@/test/api';
import { makeJsonRequest } from '@/test/request';

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));

// lib/ct/profile.ts runs for real against a fake customer endpoint.
const execute = vi.fn();
const post = vi.fn();
const customer = { id: 'c1', version: 4, email: 'sam@example.com', firstName: 'Sam', lastName: 'Rivera' };
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    customers: () => ({
      withId: () => ({ get: () => ({ execute: () => execute() }), post: (arg: unknown) => ({ execute: () => post(arg) }) }),
    }),
  },
}));

import { PATCH } from './route';

const patch = (body: unknown) => makeJsonRequest('/api/account/profile', body, { method: 'PATCH' });

beforeEach(() => {
  getSession.mockReset().mockResolvedValue({ customerId: 'c1' });
  execute.mockReset().mockResolvedValue({ body: customer });
  post.mockReset().mockImplementation(async ({ body }: { body: { actions: Array<{ firstName?: string; lastName?: string }> } }) => ({
    body: { ...customer, version: 5, ...Object.assign({}, ...body.actions.map(({ firstName, lastName }) => (firstName ? { firstName } : { lastName }))) },
  }));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('account-and-self-service: name change', () => {
  it('signed out: 401 and no commercetools call', async () => {
    getSession.mockResolvedValue({});
    await expectUnauthenticated(PATCH, [execute, post], patch({ firstName: 'A', lastName: 'B' }));
  });

  it('changes the first and last name with setFirstName / setLastName at the current version and answers the new user', async () => {
    const response = await PATCH(patch({ firstName: ' Alex ', lastName: 'Chen' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: 'c1', firstName: 'Alex', lastName: 'Chen', email: 'sam@example.com' });
    expect(post).toHaveBeenCalledWith({
      body: { version: 4, actions: [{ action: 'setFirstName', firstName: 'Alex' }, { action: 'setLastName', lastName: 'Chen' }] },
    });
  });

  it('never touches the email (changing it would de-verify the account)', async () => {
    await PATCH(patch({ firstName: 'Alex', lastName: 'Chen', email: 'x@example.com' }));
    expect(JSON.stringify(post.mock.calls)).not.toContain('changeEmail');
  });

  it('an unchanged name makes no update call', async () => {
    const response = await PATCH(patch({ firstName: 'Sam', lastName: 'Rivera' }));
    expect(response.status).toBe(200);
    expect(post).not.toHaveBeenCalled();
  });

  it('a missing or over-long name answers 400 naming the field', async () => {
    const response = await PATCH(patch({ firstName: '  ', lastName: 'x'.repeat(101) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ fields: { firstName: 'required', lastName: 'invalid' } });
    expect(post).not.toHaveBeenCalled();
  });

  it('a platform failure is sanitised', async () => {
    post.mockRejectedValue(Object.assign(new Error('boom Alex Chen'), { statusCode: 500 }));
    await expectSanitizedError(PATCH, ['Alex', 'boom'], patch({ firstName: 'Alex', lastName: 'Chen' }));
  });
});
