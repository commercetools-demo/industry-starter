// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFake, type FakeCustomer } from '../../test/portal-fakes';

const holder = vi.hoisted(() => ({ root: undefined as unknown, prov: undefined as unknown }));
vi.mock('./client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (holder.root as Record<string, unknown>)[p as string] }), provisioningRoot: new Proxy({}, { get: (_t, p) => (holder.prov as Record<string, unknown>)[p as string] }) }));
const team = await import('./team');
const { teamInviteSchema } = await import('../portal/schemas');

const customers: FakeCustomer[] = [
  { id: 'admin', version: 1, email: 'admin@co.test', firstName: 'Ada', lastName: 'Admin' },
  { id: 'site', version: 1, email: 'site@co.test', firstName: 'Sam', lastName: 'Site' },
  { id: 'fin', version: 1, email: 'fin@co.test', firstName: 'Fran', lastName: 'Fin' },
];
const associates = [{ customerId: 'admin', roleKeys: ['mpw-admin'] }, { customerId: 'site', roleKeys: ['mpw-site-contact'] }, { customerId: 'fin', roleKeys: ['mpw-finance'] }];
const as = (customerId: string) => ({ customerId, businessUnitKey: 'co' });
let fake: ReturnType<typeof createFake>;
beforeEach(() => { fake = createFake({ associates, customers }); holder.root = fake.root; holder.prov = fake.root; });

describe('malva-client-portal › Sites and team › Invite a user', () => {
  it('creates a verified customer with a random one-time password and the mustChangePassword flag, then associates it with the chosen role', async () => {
    const res = await team.inviteColleague(as('admin'), { firstName: 'New', lastName: 'Colleague', email: 'new@co.test', roleKey: 'mpw-site-contact' });
    expect(res.temporaryPassword).toMatch(/^[A-Za-z2-9]{5}-[A-Za-z2-9]{5}-[A-Za-z2-9]{5}$/);
    const body = fake.state.created[0] as { password: string; isEmailVerified: boolean; custom: { fields: Record<string, unknown> } };
    expect(body.password).toBe(res.temporaryPassword);
    expect(body.isEmailVerified).toBe(true);
    expect(body.custom.fields.mustChangePassword).toBe(true);
    expect(fake.state.associates.find((a) => a.customerId === res.member.customerId)?.roleKeys).toEqual(['mpw-site-contact']);
    expect(res.member).toMatchObject({ email: 'new@co.test', roleKeys: ['mpw-site-contact'], isYou: false });
  });
  it('each invitation gets a different password', () => {
    expect(team.generateTemporaryPassword()).not.toBe(team.generateTemporaryPassword());
  });
  it('the password is never part of the team listing', async () => {
    await team.inviteColleague(as('admin'), { firstName: 'N', lastName: 'C', email: 'n@co.test', roleKey: 'mpw-finance' });
    expect(JSON.stringify(await team.listTeam(as('admin')))).not.toMatch(/password/i);
  });
  it('an email that already has an account is refused and nothing is associated', async () => {
    await expect(team.inviteColleague(as('admin'), { firstName: 'S', lastName: 'S', email: 'site@co.test', roleKey: 'mpw-finance' })).rejects.toMatchObject({ status: 409 });
    expect(fake.state.associates).toHaveLength(3);
  });
  it('a failing association deletes the customer again (no half-created account)', async () => {
    fake.state.conflicts = 10;
    await expect(team.inviteColleague(as('admin'), { firstName: 'N', lastName: 'C', email: 'x@co.test', roleKey: 'mpw-finance' })).rejects.toMatchObject({ status: 409 });
    expect(fake.state.deleted).toHaveLength(1);
    expect([...fake.state.customers.values()].some((c) => c.email === 'x@co.test')).toBe(false);
  });
  it('without UpdateAssociates (Site contact, Finance) nothing is created', async () => {
    for (const id of ['site', 'fin']) {
      await expect(team.inviteColleague(as(id), { firstName: 'N', lastName: 'C', email: `${id}@new.test`, roleKey: 'mpw-finance' })).rejects.toMatchObject({ status: 403 });
    }
    expect(fake.state.created).toHaveLength(0);
  });
  it('a customer who is not an associate of the company is refused', async () => {
    await expect(team.listTeam(as('stranger'))).rejects.toMatchObject({ status: 403 });
  });
  it('input checks: names, work email, role', () => {
    const msg = (v: unknown) => { const r = teamInviteSchema.safeParse(v); return r.success ? null : r.error.issues[0]?.message; };
    const ok = { firstName: 'a', lastName: 'x', email: 'a@b.co', roleKey: 'mpw-admin' };
    expect(msg({ ...ok, firstName: '' })).toBe('Enter their first name.');
    expect(msg({ ...ok, email: 'nope' })).toBe('Enter a valid work email.');
    expect(msg({ ...ok, email: 'a@mailinator.com' })).toBe('Use their work email address.');
    expect(msg({ ...ok, roleKey: 'superuser' })).toBe('Choose a role.');
    expect(teamInviteSchema.parse({ ...ok, firstName: ' a ', email: 'A@B.co' })).toEqual(ok);
  });
});

describe('malva-client-portal › Sites and team › Last administrator', () => {
  it('the only administrator cannot demote themselves', async () => {
    await expect(team.changeRole(as('admin'), 'admin', 'mpw-finance')).rejects.toMatchObject({ status: 409, message: expect.stringContaining('at least one administrator') });
    expect(fake.state.associates.find((a) => a.customerId === 'admin')?.roleKeys).toEqual(['mpw-admin']);
  });
  it('the only administrator cannot remove themselves', async () => {
    await expect(team.removeColleague(as('admin'), 'admin')).rejects.toMatchObject({ status: 409 });
    expect(fake.state.associates).toHaveLength(3);
  });
  it('with a second administrator the first may be demoted or removed', async () => {
    await team.changeRole(as('admin'), 'site', 'mpw-admin');
    await team.changeRole(as('admin'), 'admin', 'mpw-finance');
    expect(fake.state.associates.filter((a) => a.roleKeys.includes('mpw-admin')).map((a) => a.customerId)).toEqual(['site']);
    await expect(team.removeColleague(as('site'), 'site')).rejects.toMatchObject({ status: 409 });
    await team.removeColleague(as('site'), 'admin');
    expect(fake.state.associates.map((a) => a.customerId)).toEqual(['site', 'fin']);
  });
  it('other members change role and are removed freely; an unknown member is not found', async () => {
    const after = await team.changeRole(as('admin'), 'fin', 'mpw-site-contact');
    expect(after.members.find((m) => m.customerId === 'fin')?.roleKeys).toEqual(['mpw-site-contact']);
    await team.removeColleague(as('admin'), 'site');
    await expect(team.removeColleague(as('admin'), 'ghost')).rejects.toMatchObject({ status: 404 });
  });
  it('a concurrent change is retried on fresh data; the guard still holds', async () => {
    fake.state.conflicts = 1;
    await team.changeRole(as('admin'), 'fin', 'mpw-site-contact');
    expect(fake.state.associates.find((a) => a.customerId === 'fin')?.roleKeys).toEqual(['mpw-site-contact']);
  });
  it('Site contact and Finance cannot change roles or remove anyone', async () => {
    await expect(team.changeRole(as('site'), 'fin', 'mpw-admin')).rejects.toMatchObject({ status: 403 });
    await expect(team.removeColleague(as('fin'), 'site')).rejects.toMatchObject({ status: 403 });
    expect(fake.state.posts).toHaveLength(0);
  });
  it('the listing says who may edit and who "you" are', async () => {
    expect((await team.listTeam(as('admin'))).canEdit).toBe(true);
    const finance = await team.listTeam(as('fin'));
    expect(finance.canEdit).toBe(false);
    expect(finance.members.filter((m) => m.isYou).map((m) => m.customerId)).toEqual(['fin']);
    expect(finance.members.map((m) => m.name)).toContain('Ada Admin');
  });
});
