// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const customerPost = vi.fn();
const customerDelete = vi.fn();
const buPost = vi.fn();
vi.mock('./client', () => ({
  apiRoot: { customers: () => ({ post: (a: unknown) => ({ execute: () => customerPost(a) }), withId: () => ({ delete: (a: unknown) => ({ execute: () => customerDelete(a) }) }) }) },
  provisioningRoot: { businessUnits: () => ({ post: (a: unknown) => ({ execute: () => buPost(a) }) }) },
}));
const { registerCompany, slugify, companyKey } = await import('./registration');

const input = { companyName: 'Acme Plant Ltd', sector: 'manufacturing' as const, firstName: 'A', lastName: 'B', jobTitle: 'Head', email: 'a@acme.co', phone: '1', password: 'correct-horse-9' };
beforeEach(() => { customerPost.mockReset(); customerDelete.mockReset(); buPost.mockReset(); customerPost.mockResolvedValue({ body: { customer: { id: 'c1', version: 1, email: 'a@acme.co', firstName: 'A', lastName: 'B' } } }); buPost.mockResolvedValue({ body: {} }); customerDelete.mockResolvedValue({}); });

describe('malva-client-portal › Open registration', () => {
  it('Register: verified customer, Active company in the store, administrator association', async () => {
    const result = await registerCompany(input, 'mpw-web');
    expect(result).toMatchObject({ status: 'created', customer: { id: 'c1' } });
    expect(customerPost.mock.calls[0]![0].body).toMatchObject({ isEmailVerified: true, email: 'a@acme.co' });
    const unit = buPost.mock.calls[0]![0].body;
    expect(unit).toMatchObject({ unitType: 'Company', status: 'Active', stores: [{ typeId: 'store', key: 'mpw-web' }], custom: { fields: { sector: 'manufacturing' } } });
    expect(unit.key).toMatch(/^mpw-acme-plant-ltd-[0-9a-f]{4}$/);
    expect(unit.associates[0]).toMatchObject({ customer: { id: 'c1' }, associateRoleAssignments: [{ associateRole: { key: 'mpw-admin' } }] });
  });
  it('a failing company step deletes the customer and rethrows (no half-created account)', async () => {
    buPost.mockRejectedValue(new Error('boom'));
    await expect(registerCompany({ ...input, email: 'b@acme.co' })).rejects.toThrow('boom');
    expect(customerDelete).toHaveBeenCalledWith({ queryArgs: { version: 1 } });
  });
  it('Email already registered: nothing else is created', async () => {
    customerPost.mockRejectedValue({ body: { errors: [{ code: 'DuplicateField' }] } });
    expect(await registerCompany({ ...input, email: 'c@acme.co' })).toEqual({ status: 'duplicate' });
    expect(buPost).not.toHaveBeenCalled();
  });
  it('two concurrent calls for one email create one account', async () => {
    const [a, b] = await Promise.all([registerCompany({ ...input, email: 'd@acme.co' }), registerCompany({ ...input, email: 'd@acme.co' })]);
    expect([a.status, b.status].sort()).toEqual(['created', 'duplicate']);
    expect(customerPost).toHaveBeenCalledTimes(1);
  });
  it('keys are slugged and random-suffixed', () => {
    expect(slugify('Müller & Söhne GmbH!')).toBe('muller-sohne-gmbh');
    expect(companyKey('X')).not.toBe(companyKey('X'));
  });
});
