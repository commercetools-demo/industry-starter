import { checkPassword } from '../../lib/config/password';
import { EXIT } from './config';
import { ensureCustomerFields } from './customer-fields';
import { buildFinancingCustomers, createFinancingCustomers, generatePassword, main } from './create-financing-customers';
import { FakeCt } from './test/fake-ct';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom', CTP_SEED_AUTH_URL: 'a', CTP_SEED_API_URL: 'b', CTP_SEED_CLIENT_ID: 'c', CTP_SEED_CLIENT_SECRET: 'd' };
const fixedRandom = (size: number): Buffer => Buffer.alloc(size, 0xab);

describe('financing QA customers', () => {
  it('two drafts: one approved and one declined (creditApproved false), both verified and marked as demo data', () => {
    const [ok, declined] = buildFinancingCustomers('1a2b3c4d', { ok: 'Pw-ok-1', declined: 'Pw-declined-1' });
    expect(ok).toMatchObject({ key: 'qa-fin-ok-1a2b3c4d', email: 'qa-fin-ok-1a2b3c4d@example.com', isEmailVerified: true });
    expect(declined).toMatchObject({ key: 'qa-fin-declined-1a2b3c4d', email: 'qa-fin-declined-1a2b3c4d@example.com' });
    expect(ok?.custom).toEqual({ type: { typeId: 'type', key: 'malva-customer' }, fields: { creditApproved: true, demoMarker: 'malva-demo' } });
    expect(declined?.custom.fields.creditApproved).toBe(false);
  });

  it('generated passwords satisfy the shop password policy and differ between calls', () => {
    const first = generatePassword();
    expect(checkPassword(first, { email: 'qa-fin-ok-1a2b3c4d@example.com' }).ok).toBe(true);
    expect(first).not.toBe(generatePassword());
    expect(checkPassword(generatePassword(fixedRandom)).ok).toBe(true);
  });

  it('creates both customers through the admin api and deletes nothing', async () => {
    const api = new FakeCt();
    await ensureCustomerFields(api);
    api.writes = 0;
    api.log.length = 0;
    const created = await createFinancingCustomers(api);
    expect(created.map((customer) => customer.creditApproved)).toEqual([true, false]);
    expect(created.every((customer) => /^qa-fin-(ok|declined)-[0-9a-f]{8}@example\.com$/.test(customer.email))).toBe(true);
    expect(api.writes).toBe(2);
    expect(api.log.filter((line) => line.startsWith('delete'))).toEqual([]);
    expect(api.log.filter((line) => line.startsWith('create customers'))).toHaveLength(2);
  });

  it('refuses without the confirm flag or for another project, writing nothing', async () => {
    const api = new FakeCt();
    expect(await main([], { api, source: SOURCE, log: () => undefined })).toBe(EXIT.TARGET_REFUSED);
    expect(await main(['--confirm-project', 'other'], { api, source: { ...SOURCE, CTP_SEED_PROJECT_KEY: 'other' }, log: () => undefined })).toBe(EXIT.TARGET_REFUSED);
    expect(api.writes).toBe(0);
  });

  it('prints each email with its password once, to the log only', async () => {
    const api = new FakeCt();
    const lines: string[] = [];
    expect(await main(['--confirm-project', 'spec-test-b2c-telecom'], { api, source: SOURCE, log: (line) => lines.push(line) })).toBe(EXIT.OK);
    expect(lines.filter((line) => line.includes('@example.com'))).toHaveLength(2);
    expect(lines[0]).toMatch(/^approved {2}qa-fin-ok-[0-9a-f]{8}@example\.com {2}\S+$/);
    expect(lines[1]).toMatch(/^declined {2}qa-fin-declined-[0-9a-f]{8}@example\.com {2}\S+$/);
    expect(lines.at(-1)).toContain('seed:reset');
  });
});
