import { EXIT } from './config';
import { ensureCustomerFields, main } from './customer-fields';
import { customerType } from './data/custom-types/customer';
import { FakeCt } from './test/fake-ct';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom', CTP_SEED_AUTH_URL: 'a', CTP_SEED_API_URL: 'b', CTP_SEED_CLIENT_ID: 'c', CTP_SEED_CLIENT_SECRET: 'd' };

const withoutField = () => ({ ...customerType, fieldDefinitions: customerType.fieldDefinitions.filter((f) => f.name !== 'sessionsValidAfter') });

describe('seed:customer-fields', () => {
  it('creates the type with the field when it is missing', async () => {
    const api = new FakeCt();
    expect(await ensureCustomerFields(api)).toBe('created');
    const created = (await api.get('types/key=malva-customer')) as { fieldDefinitions: { name: string; type: { name: string } }[] };
    expect(created.fieldDefinitions.find((f) => f.name === 'sessionsValidAfter')?.type.name).toBe('DateTime');
  });

  it('adds only the missing field to an existing type', async () => {
    const api = new FakeCt();
    await api.post('types', withoutField());
    api.writes = 0;
    expect(await ensureCustomerFields(api)).toBe('updated');
    expect(api.writes).toBe(1);
    const updated = (await api.get('types/key=malva-customer')) as { fieldDefinitions: { name: string }[] };
    expect(updated.fieldDefinitions.map((f) => f.name)).toEqual(customerType.fieldDefinitions.map((f) => f.name));
  });

  it('is idempotent: a second run sends nothing', async () => {
    const api = new FakeCt();
    await ensureCustomerFields(api);
    api.writes = 0;
    expect(await ensureCustomerFields(api)).toBe('unchanged');
    expect(api.writes).toBe(0);
  });

  it('refuses a project other than spec-test-b2c-telecom and writes nothing without the confirm flag', async () => {
    const api = new FakeCt();
    expect(await main([], { api, source: SOURCE, log: () => undefined })).toBe(EXIT.TARGET_REFUSED);
    expect(await main(['--confirm-project', 'other'], { api, source: { ...SOURCE, CTP_SEED_PROJECT_KEY: 'other' }, log: () => undefined })).toBe(EXIT.TARGET_REFUSED);
    expect(api.writes).toBe(0);
  });

  it('writes with the confirm flag and logs the outcome', async () => {
    const api = new FakeCt();
    const lines: string[] = [];
    expect(await main(['--confirm-project', 'spec-test-b2c-telecom'], { api, source: SOURCE, log: (line) => lines.push(line) })).toBe(EXIT.OK);
    expect(lines.join('\n')).toContain('malva-customer');
  });
});
