import { EXIT } from './config';
import { CtHttpError, type CtApi, type Query } from './lib';
import { DEMO_CARDS, ensureCard, main, methodDraft, methodKey } from './payment-methods';
import { FakeCt } from './test/fake-ct';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom', CTP_SEED_AUTH_URL: 'a', CTP_SEED_API_URL: 'b', CTP_SEED_CLIENT_ID: 'c', CTP_SEED_CLIENT_SECRET: 'd' };
const CUSTOMER = 'abcdef12-0000-0000-0000-000000000000';

type Row = Record<string, unknown> & { id: string; version: number };

/** Types go to the shared fake; customers and payment methods are kept here. */
class Mini implements CtApi {
  fake = new FakeCt();
  methods = new Map<string, Row>();
  customers: Array<{ id: string; email: string }> = [{ id: CUSTOMER, email: 'qa-t1@example.com' }];
  posts: Array<{ path: string; body: unknown }> = [];
  get writes(): number {
    return this.fake.writes + this.posts.length;
  }
  set writes(value: number) {
    this.fake.writes = value;
  }
  async get(path: string, query?: Query): Promise<unknown | null> {
    if (path === 'customers') return { results: this.customers.filter((c) => `email="${c.email}"` === query?.where) };
    if (path.startsWith('payment-methods/key=')) return this.methods.get(path.slice('payment-methods/key='.length)) ?? null;
    return this.fake.get(path, query);
  }
  async post(path: string, body: unknown): Promise<unknown> {
    if (path === 'payment-methods') {
      const draft = body as { key: string };
      const row = { id: `pm-${this.methods.size + 1}`, version: 1, paymentMethodStatus: 'Active', default: false, ...draft } as Row;
      this.methods.set(draft.key, row);
      this.posts.push({ path, body });
      return row;
    }
    if (path.startsWith('payment-methods/key=')) {
      const row = this.methods.get(path.slice('payment-methods/key='.length));
      if (!row) throw new CtHttpError(404, 'nope');
      for (const action of (body as { actions: Array<Record<string, unknown>> }).actions) {
        if (action.action === 'setPaymentMethodStatus') row.paymentMethodStatus = action.paymentMethodStatus;
        if (action.action === 'setDefault') row.default = action.default;
      }
      row.version += 1;
      this.posts.push({ path, body });
      return row;
    }
    return this.fake.post(path, body);
  }
  async del(path: string, query: { version: number }): Promise<unknown> {
    return this.fake.del(path, query);
  }
}

const run = (api: Mini, argv: string[]) => main(argv, { api, source: SOURCE, log: () => undefined });
const OK = ['--confirm-project', 'spec-test-b2c-telecom', '--email', 'qa-t1@example.com'];

describe('seed:payment-methods', () => {
  it('builds the demo drafts: fake tokens, descriptor fields and a key per customer', () => {
    const visa = methodDraft(DEMO_CARDS[0]!, CUSTOMER);
    expect(visa).toMatchObject({
      key: 'malva-pm-visa-4242-abcdef12',
      customer: { typeId: 'customer', id: CUSTOMER },
      method: 'card',
      paymentInterface: 'malva-demo',
      token: { value: 'tok_demo_visa_4242' },
      default: true,
      name: { 'en-US': 'Visa ending 4242', 'de-DE': 'Visa endet auf 4242' },
      custom: { type: { key: 'malva-payment-method' }, fields: { brand: 'visa', last4: '4242', expMonth: 3, expYear: 2030 } },
    });
    expect(methodDraft(DEMO_CARDS[1]!, CUSTOMER)).toMatchObject({ key: 'malva-pm-mc-5454-abcdef12', default: false, custom: { fields: { expMonth: 11, expYear: 2029 } } });
  });

  it('creates the type and both cards, then a second run sends nothing', async () => {
    const api = new Mini();
    expect(await run(api, OK)).toBe(EXIT.OK);
    expect(api.fake.byKey('types', 'malva-payment-method')).toBeDefined();
    expect([...api.methods.keys()].sort()).toEqual([methodKey(DEMO_CARDS[0]!, CUSTOMER), methodKey(DEMO_CARDS[1]!, CUSTOMER)].sort());
    const before = api.writes;
    expect(await run(api, OK)).toBe(EXIT.OK);
    expect(api.writes).toBe(before);
  });

  it('brings back a card the customer removed (Inactive) and restores the default flag', async () => {
    const api = new Mini();
    await run(api, OK);
    const visa = api.methods.get(methodKey(DEMO_CARDS[0]!, CUSTOMER)) as Row;
    visa.paymentMethodStatus = 'Inactive';
    visa.default = false;
    expect(await ensureCard(api, DEMO_CARDS[0]!, CUSTOMER)).toBe('restored');
    expect(visa).toMatchObject({ paymentMethodStatus: 'Active', default: true });
  });

  it('exits with a clear failure when the customer does not exist', async () => {
    const api = new Mini();
    api.customers = [];
    const lines: string[] = [];
    expect(await main(OK, { api, source: SOURCE, log: (line) => lines.push(line) })).toBe(EXIT.FAILED);
    expect(lines.join('\n')).toContain('No customer');
    expect(api.methods.size).toBe(0);
  });

  it('refuses another project key and a run without the confirm flag, writing nothing', async () => {
    const api = new Mini();
    expect(await run(api, ['--email', 'qa-t1@example.com'])).toBe(EXIT.TARGET_REFUSED);
    expect(await main(['--confirm-project', 'other', '--email', 'qa-t1@example.com'], { api, source: { ...SOURCE, CTP_SEED_PROJECT_KEY: 'other' }, log: () => undefined })).toBe(EXIT.TARGET_REFUSED);
    expect(api.writes).toBe(0);
  });
});
