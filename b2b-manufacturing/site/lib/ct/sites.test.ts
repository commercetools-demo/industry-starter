// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFake, type FakeAddress } from '../../test/portal-fakes';

const holder = vi.hoisted(() => ({ root: undefined as unknown }));
const threads = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (holder.root as Record<string, unknown>)[p as string] }), provisioningRoot: {} }));
vi.mock('./portal-quotes', () => ({ listThreads: threads, OPEN_STATUSES: ['submitted', 'preparing', 'ready', 'renegotiation'] }));
const sites = await import('./sites');
const { siteSchema } = await import('../portal/schemas');

const addresses: FakeAddress[] = [
  { id: 'a1', key: 'site-1', company: 'Main plant', streetName: '1 Mill Lane', city: 'Cleveland', postalCode: '44114', country: 'US' },
  { id: 'a2', key: 'site-2', company: 'Depot', streetName: '22 Depot Road', city: 'Columbus', postalCode: '43215', country: 'US' },
];
const as = (customerId: string) => ({ customerId, businessUnitKey: 'co' });
const input = { name: 'Yard', contactName: 'Yara Yard', phone: '555 0100', streetName: '9 Yard Way', city: 'Akron', postalCode: '44301', country: 'US' };
let fake: ReturnType<typeof createFake>;
beforeEach(() => {
  fake = createFake({
    addresses, defaultId: 'a1',
    associates: [{ customerId: 'admin', roleKeys: ['mpw-admin'] }, { customerId: 'site', roleKeys: ['mpw-site-contact'] }, { customerId: 'fin', roleKeys: ['mpw-finance'] }],
    customers: [],
  });
  holder.root = fake.root; threads.mockReset(); threads.mockResolvedValue([]);
});

describe('malva-client-portal › Sites and team › sites', () => {
  it('an administrator sees the sites with the default marked and may edit', async () => {
    const res = await sites.listSites(as('admin'));
    expect(res.canEdit).toBe(true);
    expect(res.sites.map((s) => [s.key, s.name, s.isDefault])).toEqual([['site-1', 'Main plant', true], ['site-2', 'Depot', false]]);
  });
  it('add: a new address with a key, the site contact kept in additionalAddressInfo and phone', async () => {
    const res = await sites.addSite(as('admin'), input);
    expect(res.sites).toHaveLength(3);
    const added = fake.state.addresses[2]!;
    expect(added).toMatchObject({ company: 'Yard', additionalAddressInfo: 'Yara Yard', phone: '555 0100', country: 'US' });
    expect(added.key).toMatch(/^co-site-[0-9a-f]{6}$/);
    expect(res.sites[2]).toMatchObject({ name: 'Yard', contactName: 'Yara Yard', isDefault: false });
  });
  it('the first site of a company becomes the default', async () => {
    fake.state.addresses = []; fake.state.defaultId = undefined;
    const res = await sites.addSite(as('admin'), input);
    expect(res.sites[0]?.isDefault).toBe(true);
  });
  it('edit and choose the default', async () => {
    await sites.updateSite(as('admin'), 'site-2', { ...input, name: 'Depot North' });
    expect(fake.state.addresses[1]).toMatchObject({ key: 'site-2', company: 'Depot North', city: 'Akron' });
    const res = await sites.setDefaultSite(as('admin'), 'site-2');
    expect(res.sites.find((s) => s.isDefault)?.key).toBe('site-2');
    await expect(sites.updateSite(as('admin'), 'nope', input)).rejects.toMatchObject({ status: 404 });
  });
  it('remove a site', async () => {
    const res = await sites.removeSite(as('admin'), 'site-2');
    expect(res.sites.map((s) => s.key)).toEqual(['site-1']);
  });
  it('removing a site that an open quote request ships to is refused with an explanation', async () => {
    threads.mockResolvedValue([{ id: 'r1', status: 'submitted', siteKey: 'site-2', site: 'Depot' }]);
    await expect(sites.removeSite(as('admin'), 'site-2')).rejects.toMatchObject({ status: 409, message: expect.stringContaining('open quote request') });
    expect(fake.state.addresses).toHaveLength(2);
  });
  it('a closed request does not block removal; a request without a site key is matched by the site name', async () => {
    threads.mockResolvedValue([{ id: 'r1', status: 'accepted', siteKey: 'site-2', site: 'Depot' }]);
    await sites.removeSite(as('admin'), 'site-2');
    threads.mockResolvedValue([{ id: 'r2', status: 'ready', site: 'Main plant' }]);
    fake.state.defaultId = undefined;
    await expect(sites.removeSite(as('admin'), 'site-1')).rejects.toMatchObject({ status: 409 });
  });
  it('the default site cannot be removed until another is chosen', async () => {
    await expect(sites.removeSite(as('admin'), 'site-1')).rejects.toMatchObject({ status: 409, message: expect.stringContaining('default') });
  });
  it('Site contact and Finance see the sites read only; every write is refused', async () => {
    for (const id of ['site', 'fin']) {
      expect((await sites.listSites(as(id))).canEdit).toBe(false);
      await expect(sites.addSite(as(id), input)).rejects.toMatchObject({ status: 403 });
      await expect(sites.updateSite(as(id), 'site-1', input)).rejects.toMatchObject({ status: 403 });
      await expect(sites.removeSite(as(id), 'site-2')).rejects.toMatchObject({ status: 403 });
      await expect(sites.setDefaultSite(as(id), 'site-2')).rejects.toMatchObject({ status: 403 });
    }
    expect(fake.state.posts).toHaveLength(0);
  });
  it('input checks name the first missing field and the country list', () => {
    const msg = (v: unknown) => { const r = siteSchema.safeParse(v); return r.success ? null : r.error.issues[0]?.message; };
    expect(msg({ ...input, name: '' })).toBe('Enter a name for the site.');
    expect(msg({ ...input, postalCode: ' ' })).toBe('Enter the postal code.');
    expect(msg({ ...input, country: 'FR' })).toBe('Choose a country.');
    expect(siteSchema.parse({ ...input, country: 'de' }).country).toBe('DE');
  });
});
