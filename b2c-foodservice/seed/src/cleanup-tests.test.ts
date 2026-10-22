// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import type { Kind } from './api';
import {
  apiTestData, assertApplyAllowed, parseCleanupArgs, parseRegister, runCleanupTests,
  type CleanupRunOptions, type DeletableKind, type RecurringOrdersPort, type TestDataPort,
} from './cleanup-tests';
import { ApiError, FakeApi } from './fake-api';

const KEY = 'spec-test-b2c-food';
const APPLY: CleanupRunOptions = { apply: true, confirm: KEY, projectKey: KEY, expectedProjectKey: KEY };
const DRY: CleanupRunOptions = { apply: false, projectKey: KEY, expectedProjectKey: KEY };

/** An in-memory recurring-orders endpoint that follows the commercetools rule: only Canceled or Expired ones can be deleted. */
function memoryRecurring(initial: Record<string, { state: string; key?: string }>) {
  const store = new Map(Object.entries(initial).map(([id, v]) => [id, { id, version: 1, ...v }]));
  const calls: string[] = [];
  const port: RecurringOrdersPort = {
    get: async (id) => {
      const r = store.get(id);
      return r ? { ...r } : undefined;
    },
    cancel: async (id, version) => {
      const r = store.get(id);
      if (!r) throw new ApiError(404, 'not found');
      if (r.version !== version) throw new ApiError(409, 'ConcurrentModification');
      r.state = 'Canceled';
      r.version += 1;
      calls.push(`cancel ${id}`);
      return r.version;
    },
    remove: async (id, version) => {
      const r = store.get(id);
      if (!r) throw new ApiError(404, 'not found');
      if (r.version !== version) throw new ApiError(409, 'ConcurrentModification');
      if (r.state !== 'Canceled' && r.state !== 'Expired') throw new ApiError(400, 'InvalidOperation');
      store.delete(id);
      calls.push(`delete ${id}`);
    },
  };
  return { port, store, calls };
}

/** A project with test records (tst-*), data nobody registered, seed data and a real-looking customer. */
function world() {
  const api = new FakeApi();
  const ref = (id: string) => ({ typeId: 'customer', id });
  const tst1 = api.put('customers', { email: 'tst-20261022-1@example.com' });
  const tst2 = api.put('customers', { email: 'tst-20261022-2@example.com' });
  const fresh = api.put('customers', { email: 'tst-20261022-3@example.com' }); // nothing references it
  const unregistered = api.put('customers', { email: 'unregistered.shopper@example.com' });
  const maya = api.put('customers', { key: 'mcf-customer-maya', email: 'maya.okonkwo@example.com' });
  const real = api.put('customers', { email: 'real.person@gmail.com' });
  const lookalike = api.put('customers', { email: 'a@example.com.evil.org' });
  const review1 = api.put('reviews', { rating: 5, customer: ref(tst1.id) });
  const review2 = api.put('reviews', { rating: 4, customer: ref(unregistered.id) });
  const seedReview = api.put('reviews', { key: 'mcf-review-mcf-pod-1', rating: 5 });
  const list1 = api.put('shopping-lists', { customer: ref(tst2.id) });
  const seedList = api.put('shopping-lists', { key: 'mcf-saved-maya', customer: ref(maya.id) });
  const recurring = memoryRecurring({ 'ro-active': { state: 'Active' }, 'ro-canceled': { state: 'Canceled' }, 'ro-unregistered': { state: 'Active' } });
  const reads: string[] = [];
  const inner = apiTestData(api, recurring.port);
  const port: TestDataPort = { ...inner, read: async (k, id) => { reads.push(`${k} ${id}`); return inner.read(k, id); } };
  const ids = { tst1: tst1.id, tst2: tst2.id, fresh: fresh.id, unregistered: unregistered.id, maya: maya.id, real: real.id, lookalike: lookalike.id, review1: review1.id, review2: review2.id, seedReview: seedReview.id, list1: list1.id, seedList: seedList.id };
  return { api, port, recurring, reads, ids };
}

const table = (...rows: string[]): string => ['# Test data', '', 'Records the journeys created.', '', '| kind | id | note |', '| --- | --- | --- |', ...rows].join('\n');
const run = async (port: TestDataPort, text: string, opts: CleanupRunOptions) => {
  const lines: string[] = [];
  const summary = await runCleanupTests(port, parseRegister(text), opts, (l) => lines.push(l));
  return { summary, lines, out: lines.join('\n') };
};
const remaining = (api: FakeApi, kind: Kind): string[] => api.all(kind).map((r) => r.id).sort();

describe('seed:cleanup-tests', () => {
  it('cleanup deletes only registered records', async () => {
    const { api, port, recurring, ids } = world();
    // the customer is listed first on purpose: reviews and lists must go before it (the fake API refuses a referenced customer)
    const text = table(
      `| customer | ${ids.tst1} | J2 shopper |`,
      `| customer | ${ids.tst2} | J3 shopper |`,
      `| review | ${ids.review1} | J5 |`,
      `| shopping-list | ${ids.list1} | J9 |`,
      '| recurring-order | ro-active | J3 |',
      '| recurring-order | ro-canceled | J4 |',
      '| order | order-1 | J2 |',
      '| cart | cart-1 | J1 |',
    );
    const r = await run(port, text, APPLY);
    expect(r.summary).toEqual({ deletions: 6, skipped: 2, refused: 0, failed: 0 });
    expect(r.lines.at(-1)).toBe('6 deletion(s), 2 skipped, 0 refused');
    // what was listed is gone ...
    expect(remaining(api, 'customers')).toEqual([ids.fresh, ids.unregistered, ids.maya, ids.real, ids.lookalike].sort());
    expect(remaining(api, 'reviews')).toEqual([ids.review2, ids.seedReview].sort());
    expect(remaining(api, 'shopping-lists')).toEqual([ids.seedList]);
    expect([...recurring.store.keys()]).toEqual(['ro-unregistered']);
    // ... and exactly four deletes went to the Customers, Reviews and Shopping Lists endpoints (two customers, a review, a list)
    expect(api.writes).toBe(4);
    // an Active recurring order is canceled before it is deleted (commercetools only deletes Canceled or Expired ones)
    expect(recurring.calls).toEqual(['cancel ro-active', 'delete ro-active', 'delete ro-canceled']);
  });

  it('cleanup dry run changes nothing', async () => {
    const { api, port, recurring, ids } = world();
    const before = JSON.stringify([...api.data.entries()].map(([k, m]) => [k, [...m.values()]]));
    const text = table(`| customer | ${ids.tst1} | x |`, `| review | ${ids.review1} | x |`, `| shopping-list | ${ids.list1} | x |`, '| recurring-order | ro-active | x |', '| order | order-1 | x |');
    const r = await run(port, text, DRY);
    expect(r.summary).toEqual({ deletions: 4, skipped: 1, refused: 0, failed: 0 });
    expect(r.out).toContain(`would delete customer ${ids.tst1}`);
    expect(r.out).toContain('would cancel and delete recurring-order ro-active');
    expect(r.lines.at(-1)).toBe('dry run: 4 deletion(s), 1 skipped, 0 refused');
    expect(api.writes).toBe(0);
    expect(JSON.stringify([...api.data.entries()].map(([k, m]) => [k, [...m.values()]]))).toBe(before);
    expect(recurring.calls).toEqual([]);
    // the default of the command line is a dry run; --dry-run wins over --apply
    expect(parseCleanupArgs(['--register', 'r.md'])).toEqual({ register: 'r.md', apply: false, confirm: undefined });
    expect(parseCleanupArgs(['--register', 'r.md', '--apply', '--confirm', KEY])).toEqual({ register: 'r.md', apply: true, confirm: KEY });
    expect(parseCleanupArgs(['--register', 'r.md', '--apply', '--dry-run', '--confirm', KEY]).apply).toBe(false);
  });

  it('cleanup lists orders as not deletable', async () => {
    const { port, reads } = world();
    for (const opts of [DRY, APPLY]) {
      const r = await run(port, table('| order | order-1 | J2 |', '| cart | cart-1 | J1 |', '| Order | order-2 | kind is case-insensitive |'), opts);
      expect(r.out).toContain('cannot be deleted: order order-1 (commercetools cannot delete orders)');
      expect(r.out).toContain('cannot be deleted: cart cart-1');
      expect(r.out).toContain('cannot be deleted: order order-2');
      expect(r.summary).toMatchObject({ deletions: 0, skipped: 3, refused: 0 });
    }
    expect(reads).toEqual([]); // nothing is even read for them
  });

  it('cleanup refuses a customer that is not an example.com address', async () => {
    const { api, port, ids } = world();
    const text = table(`| customer | ${ids.real} | a real person |`, `| customer | ${ids.lookalike} | look-alike domain |`, `| customer | ${ids.maya} | seed demo customer, an example.com address |`, `| customer | ${ids.fresh} | fine |`);
    const r = await run(port, text, APPLY);
    expect(r.summary).toEqual({ deletions: 1, skipped: 0, refused: 3, failed: 0 });
    expect(r.out).toContain(`REFUSED customer ${ids.real}: not an @example.com customer`);
    expect(r.out).toContain(`REFUSED customer ${ids.lookalike}: not an @example.com customer`);
    expect(r.out).toContain(`REFUSED customer ${ids.maya}: seed data (key starts with mcf-)`);
    expect(remaining(api, 'customers')).toEqual([ids.tst1, ids.tst2, ids.unregistered, ids.maya, ids.real, ids.lookalike].sort());
    expect(r.out).not.toMatch(/\S@\S|gmail|evil|real\.person|okonkwo/); // ids only, never an email (the rule text "@example.com" is not an address)
  });

  it('cleanup never deletes seed data, whatever the register says', async () => {
    const { api, port, ids } = world();
    const r = await run(port, table(`| review | ${ids.seedReview} | x |`, `| shopping-list | ${ids.seedList} | x |`), APPLY);
    expect(r.summary).toMatchObject({ deletions: 0, refused: 2 });
    expect(api.writes).toBe(0);
  });

  it('cleanup apply needs the confirm key', async () => {
    const { api, port, reads, ids } = world();
    const text = table(`| customer | ${ids.tst1} | x |`);
    await expect(run(port, text, { ...APPLY, confirm: undefined })).rejects.toThrow(/--apply needs --confirm/);
    await expect(run(port, text, { ...APPLY, confirm: 'some-other-project' })).rejects.toThrow(/--apply needs --confirm/);
    await expect(run(port, text, { ...APPLY, expectedProjectKey: 'some-other-project' })).rejects.toThrow(/mismatch/); // the project guard comes first
    await expect(run(port, text, { ...APPLY, expectedProjectKey: undefined })).rejects.toThrow(/EXPECTED_PROJECT_KEY/);
    await expect(run(port, text, { ...APPLY, projectKey: 'team-health', confirm: 'team-health', expectedProjectKey: 'team-health' })).rejects.toThrow(/another team/);
    expect(() => assertApplyAllowed(KEY, KEY, KEY)).not.toThrow();
    expect(() => assertApplyAllowed(KEY, KEY, 'other')).toThrow(/--apply needs --confirm/);
    expect(api.writes).toBe(0);
    expect(reads).toEqual([]); // refused before the first request
    // a dry run needs no confirm
    expect((await run(port, text, DRY)).summary.deletions).toBe(1);
  });

  it('cleanup reports an entry that is already gone', async () => {
    const { api, port, ids } = world();
    const text = table('| customer | customers-9999 | never existed |', '| recurring-order | ro-missing | x |', `| review | ${ids.review1} | x |`);
    const first = await run(port, text, APPLY);
    expect(first.out).toContain('already gone: customer customers-9999');
    expect(first.out).toContain('already gone: recurring-order ro-missing');
    expect(first.summary).toEqual({ deletions: 1, skipped: 2, refused: 0, failed: 0 });
    // a second run finds everything gone: no error, nothing deleted
    const second = await run(port, text, APPLY);
    expect(second.summary).toEqual({ deletions: 0, skipped: 3, refused: 0, failed: 0 });
    expect(second.lines.at(-1)).toBe('0 deletion(s), 3 skipped, 0 refused');
    expect(api.writes).toBe(1);
  });

  it('cleanup treats a record deleted between the read and the delete as already gone, and retries a moved version once', async () => {
    const { api, port, ids } = world();
    // the version moves after the read: the first delete answers 409, the retry reads the new version
    let moved = false;
    const racing: TestDataPort = {
      ...port,
      remove: async (kind: DeletableKind, id, version) => {
        if (!moved && kind === 'review' && id === ids.review1) {
          moved = true;
          await api.update('reviews', { id, version }, [{ action: 'setRating', rating: 3 }]);
        }
        return port.remove(kind, id, version);
      },
    };
    expect((await run(racing, table(`| review | ${ids.review1} | x |`), APPLY)).summary.deletions).toBe(1);
    expect(await api.getById('reviews', ids.review1)).toBeUndefined();
    // gone in between (404 on delete)
    const vanishing: TestDataPort = { ...port, remove: async (kind, id) => { throw new ApiError(404, `${kind} ${id} not found`); } };
    const r = await run(vanishing, table(`| review | ${ids.review2} | x |`), APPLY);
    expect(r.summary).toMatchObject({ deletions: 0, skipped: 1, failed: 0 });
  });

  it('cleanup reports a failure with a status and no body, and carries on', async () => {
    const { port, ids } = world();
    const broken: TestDataPort = { ...port, remove: async (kind, id, version) => {
      if (id === ids.review1) throw Object.assign(new Error('review of tst-20261022-1@example.com'), { statusCode: 400, body: { errors: [{ code: 'InvalidOperation' }] } });
      return port.remove(kind, id, version);
    } };
    const r = await run(broken, table(`| review | ${ids.review1} | x |`, `| shopping-list | ${ids.list1} | x |`), APPLY);
    expect(r.summary).toEqual({ deletions: 1, skipped: 0, refused: 0, failed: 1 });
    expect(r.out).toContain(`FAILED review ${ids.review1}: HTTP 400 InvalidOperation`);
    expect(r.out).not.toMatch(/@|tst-2026/);
    expect(r.lines.at(-1)).toBe('1 deletion(s), 0 skipped, 0 refused, 1 failed');
  });

  it('cleanup refuses an unknown kind and a malformed id, by line number, and never lists a row twice', async () => {
    const { api, port, ids } = world();
    const text = table('| user | whatever | x |', `| customer | tst-20261022-1@example.com | an email where the id belongs |`, '| review | ../customers | x |', `| review | ${ids.review1} | x |`, `| review | ${ids.review1} | again |`);
    const r = await run(port, text, APPLY);
    expect(r.summary).toEqual({ deletions: 1, skipped: 1, refused: 3, failed: 0 });
    expect(r.out).toMatch(/REFUSED line 7: unknown kind/);
    expect(r.out).toMatch(/REFUSED line 8: the id of this customer row is not a commercetools id/);
    expect(r.out).toMatch(/REFUSED line 9: the id of this review row is not a commercetools id/);
    expect(r.out).toContain(`skipped review ${ids.review1}: listed twice`);
    expect(r.out).not.toMatch(/@|\.\./);
    expect(api.writes).toBe(1);
  });

  it('cleanup prints ids only: the note column and any email stay out of the output', async () => {
    const { port, ids } = world();
    const r = await run(port, table(`| customer | ${ids.tst1} | tst-20261022-1@example.com, Jane Q. Public |`, `| review | ${ids.review2} | TST-title |`), DRY);
    expect(r.out).not.toMatch(/@|Jane|TST-title|example/);
  });
});

describe('test-data register', () => {
  it('register parser ignores header and prose lines', () => {
    const text = [
      '# Test data register',
      '',
      'Every record the journeys created. Orders and carts cannot be deleted.',
      'A line with a | pipe in prose is not a table row.',
      '',
      '| kind | id | note |',
      '| --- | :---: | ---: |',
      '| customer | c-1 | J2 |',
      '|customer|c-2|no spaces|',
      '| `review` | `r-1` | backticks are stripped |',
      '| Recurring-Order | ro-1 | kind is case-insensitive | extra | cells |',
      '| | | |',
      '| order | o-1 |',
      '  | cart | k-1 | indented rows count |',
      '',
      'Footer prose.',
    ].join('\r\n');
    expect(parseRegister(text)).toEqual([
      { line: 8, kind: 'customer', id: 'c-1' },
      { line: 9, kind: 'customer', id: 'c-2' },
      { line: 10, kind: 'review', id: 'r-1' },
      { line: 11, kind: 'recurring-order', id: 'ro-1' },
      { line: 13, kind: 'order', id: 'o-1' },
      { line: 14, kind: 'cart', id: 'k-1' },
    ]);
    expect(parseRegister('')).toEqual([]);
    expect(parseRegister('| kind | id | note |\n| --- | --- | --- |\n')).toEqual([]);
  });

  it('a register with no rows deletes nothing and says so', async () => {
    const { api, port } = world();
    const r = await run(port, '# Test data\n\nNothing yet.\n', APPLY);
    expect(r.lines).toEqual(['0 deletion(s), 0 skipped, 0 refused']);
    expect(api.writes).toBe(0);
  });
});
