// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { assertConfirm, checkOwner, parseAdvanceArgs, runAdvance, type AdvanceArgs, type AdvancePort } from './advance-order';
import { isExampleEmail } from './lib';

const KEY = 'spec-test-b2c-food';
const NUMBER = 'MC-ABCDEFGHJK';

interface Fixture { stateKey?: string; customerId?: string; customerEmail?: string; customers?: Record<string, string> }

/** An in-memory order and customer store that records every write. */
function memory(f: Fixture = {}) {
  const writes: string[] = [];
  const reads: string[] = [];
  const port: AdvancePort = {
    findByNumber: async (n) => {
      reads.push(`order ${n}`);
      return n === NUMBER ? { id: 'o1', version: 4, ...(f.stateKey ? { stateKey: f.stateKey } : {}) } : undefined;
    },
    transition: async (id, version, key) => {
      writes.push(`${id}@${version}->${key}`);
    },
    ownerOf: async (n) => (n === NUMBER ? { ...(f.customerId ? { customerId: f.customerId } : {}), ...(f.customerEmail ? { customerEmail: f.customerEmail } : {}) } : undefined),
    customerEmail: async (id) => f.customers?.[id],
  };
  return { port, writes, reads };
}

const args = (over: Partial<AdvanceArgs> = {}): AdvanceArgs => ({ orderNumber: NUMBER, to: 'ready-for-collection', dryRun: false, confirm: KEY, projectKey: KEY, expectedProjectKey: KEY, ...over });
const advance = async (port: AdvancePort, over: Partial<AdvanceArgs> = {}) => {
  const lines: string[] = [];
  const code = await runAdvance(port, args(over), (l) => lines.push(l));
  return { code, lines };
};

describe('seed:advance-order', () => {
  it('advance moves preparing to ready-for-collection', async () => {
    const { port, writes } = memory({ stateKey: 'mcf-order-preparing', customerEmail: 'tst-20261022-1@example.com' });
    const r = await advance(port);
    expect(r.code).toBe(0);
    expect(writes).toEqual(['o1@4->mcf-order-ready-for-collection']);
    expect(r.lines).toEqual([`${NUMBER} is now mcf-order-ready-for-collection`]);
  });

  it('advance moves a member order whose customer is an example.com customer', async () => {
    const { port, writes } = memory({ stateKey: 'mcf-order-ordered', customerId: 'c1', customers: { c1: 'TST-Member@Example.com' } });
    expect((await advance(port, { to: 'preparing' })).code).toBe(0);
    expect(writes).toEqual(['o1@4->mcf-order-preparing']);
  });

  it('advance refuses an order of a non-example customer', async () => {
    const member = memory({ stateKey: 'mcf-order-preparing', customerId: 'c1', customers: { c1: 'real.person@gmail.com' } });
    const r = await advance(member.port);
    expect(r.code).toBe(1);
    expect(r.lines[0]).toMatch(/^REFUSED .*not an @example\.com test customer/);
    expect(member.writes).toEqual([]);
    expect(member.reads).toEqual([]); // refused before the order state was even read

    const guest = memory({ stateKey: 'mcf-order-preparing', customerEmail: 'guest@acme.example.org' });
    expect((await advance(guest.port)).code).toBe(1);
    expect(guest.writes).toEqual([]);
  });

  it('advance refuses look-alike addresses, a vanished customer, an order with no customer and one mixed owner', async () => {
    for (const email of ['a@example.com.evil.org', 'a@evilexample.com', 'a@b@example.com', 'example.com', '@example.com', 'a@example.co']) {
      const { port, writes } = memory({ stateKey: 'mcf-order-preparing', customerEmail: email });
      expect((await advance(port)).code, email).toBe(1);
      expect(writes).toEqual([]);
    }
    const gone = memory({ stateKey: 'mcf-order-preparing', customerId: 'c-deleted', customers: {} });
    expect((await advance(gone.port)).code).toBe(1);
    const none = memory({ stateKey: 'mcf-order-preparing' });
    expect((await advance(none.port)).code).toBe(1);
    // a member order with an example.com customer but another email on the order itself
    const mixed = memory({ stateKey: 'mcf-order-preparing', customerId: 'c1', customers: { c1: 'a@example.com' }, customerEmail: 'a@gmail.com' });
    expect((await advance(mixed.port)).code).toBe(1);
    expect([gone, none, mixed].flatMap((m) => m.writes)).toEqual([]);
  });

  it('advance never prints an email address', async () => {
    const { port } = memory({ stateKey: 'mcf-order-preparing', customerEmail: 'secret.person@gmail.com' });
    const r = await advance(port);
    expect(r.lines.join('\n')).not.toMatch(/@gmail|secret/);
  });

  it('advance refuses a wrong project key', async () => {
    const { port, writes, reads } = memory({ stateKey: 'mcf-order-preparing', customerEmail: 'a@example.com' });
    await expect(runAdvance(port, args({ expectedProjectKey: 'some-other-project' }))).rejects.toThrow(/mismatch/);
    await expect(runAdvance(port, args({ expectedProjectKey: undefined }))).rejects.toThrow(/EXPECTED_PROJECT_KEY/);
    await expect(runAdvance(port, args({ projectKey: 'team-health', confirm: 'team-health', expectedProjectKey: 'team-health' }))).rejects.toThrow(/another team/);
    expect(writes).toEqual([]);
    expect(reads).toEqual([]);
  });

  it('advance refuses a confirm that is not the project key', async () => {
    const { port, writes, reads } = memory({ stateKey: 'mcf-order-preparing', customerEmail: 'a@example.com' });
    await expect(runAdvance(port, args({ confirm: 'some-other-project' }))).rejects.toThrow(/--confirm must equal/);
    await expect(runAdvance(port, args({ confirm: undefined }))).rejects.toThrow(/--confirm must equal/);
    await expect(runAdvance(port, args({ confirm: undefined, dryRun: true }))).rejects.toThrow(/--confirm must equal/); // a dry run needs it too
    expect(() => assertConfirm(KEY, KEY)).not.toThrow();
    expect(writes).toEqual([]);
    expect(reads).toEqual([]);
  });

  it('advance --dry-run writes nothing', async () => {
    const { port, writes } = memory({ stateKey: 'mcf-order-preparing', customerEmail: 'a@example.com' });
    const r = await advance(port, { dryRun: true });
    expect(r.code).toBe(0);
    expect(r.lines).toEqual([`dry run: ${NUMBER} mcf-order-preparing -> mcf-order-ready-for-collection`]);
    expect(writes).toEqual([]);
  });

  it('advance keeps the rules of seed:order: one step, no skipping, no going back, unknown order', async () => {
    const skip = memory({ stateKey: 'mcf-order-preparing', customerEmail: 'a@example.com' });
    expect((await advance(skip.port, { to: 'collected' })).lines[0]).toMatch(/cannot skip/);
    const back = memory({ stateKey: 'mcf-order-collected', customerEmail: 'a@example.com' });
    expect((await advance(back.port, { to: 'preparing' })).code).toBe(1);
    const again = memory({ stateKey: 'mcf-order-ready-for-collection', customerEmail: 'a@example.com' });
    expect((await advance(again.port)).lines[0]).toMatch(/already/);
    const { port } = memory({ customerEmail: 'a@example.com' });
    expect((await advance(port, { orderNumber: 'MC-ZZZZZZZZZZ' })).lines[0]).toMatch(/no order with number/);
    expect([skip, back, again].flatMap((m) => m.writes)).toEqual([]);
  });

  it('advance accepts only preparing, ready-for-collection and collected, and only this shop\'s order numbers', async () => {
    const { port, writes } = memory({ stateKey: 'mcf-order-ordered', customerEmail: 'a@example.com' });
    expect((await advance(port, { to: 'ordered' })).lines[0]).toMatch(/--to must be one of preparing, ready-for-collection, collected/);
    expect((await advance(port, { to: 'nonsense' })).code).toBe(1);
    expect((await advance(port, { orderNumber: '"; drop' })).lines[0]).toMatch(/not an order number/);
    expect(writes).toEqual([]);
  });

  it('parses the command line and checks the example.com rule', () => {
    expect(parseAdvanceArgs(['--order', NUMBER, '--to', 'preparing', '--confirm', KEY, '--dry-run'])).toEqual({ orderNumber: NUMBER, to: 'preparing', confirm: KEY, dryRun: true });
    expect(parseAdvanceArgs([])).toEqual({ orderNumber: '', to: '', confirm: undefined, dryRun: false });
    expect(isExampleEmail('tst-1@example.com')).toBe(true);
    expect(isExampleEmail('TST-1@EXAMPLE.COM')).toBe(true);
    expect(isExampleEmail(undefined)).toBe(false);
  });

  it('checkOwner reads the customer only for a member order', async () => {
    const { port } = memory({ customerEmail: 'a@example.com' });
    expect(await checkOwner(port, NUMBER)).toEqual({ ok: true });
    expect(await checkOwner(port, 'MC-ZZZZZZZZZZ')).toMatchObject({ ok: false });
  });
});
