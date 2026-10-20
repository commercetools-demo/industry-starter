/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoBusinessUnit, expectUnauthenticated, mockSession, sessionMock } from '../../../test/api-helpers';

const m = vi.hoisted(() => ({ callIntake: vi.fn(), createIntakeRecord: vi.fn(), finishIntakeRecord: vi.fn(), listIntakeRecords: vi.fn(), enforce: vi.fn(), later: [] as (() => Promise<void>)[] }));
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: (fn: () => Promise<void>) => { m.later.push(fn); } }));
vi.mock('@/lib/session', () => ({ getSession: async () => sessionMock.current, saveSession: vi.fn() }));
vi.mock('@/lib/auth-limits', () => ({ clientKey: () => 'ip', enforce: m.enforce }));
vi.mock('@/lib/ct/intake', () => ({ callIntake: m.callIntake }));
vi.mock('@/lib/ct/intake-records', () => ({ createIntakeRecord: m.createIntakeRecord, finishIntakeRecord: m.finishIntakeRecord, listIntakeRecords: m.listIntakeRecords }));
const { POST, GET } = await import('./route');

const session = { customerId: 'c1', businessUnitKey: 'mpw-co', customerEmail: 'ada@acme.co' };
const form = (fields: Record<string, string>, files: File[] = []) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  for (const file of files) f.append('files', file);
  return new Request('http://x/api/intake', { method: 'POST', body: f });
};
const pdf = new File(['x'], 'po.pdf', { type: 'application/pdf' });
const runLater = async () => { for (const fn of m.later.splice(0)) await fn(); };

beforeEach(() => {
  for (const fn of [m.callIntake, m.createIntakeRecord, m.finishIntakeRecord, m.listIntakeRecords, m.enforce]) fn.mockReset();
  m.later.length = 0;
  m.createIntakeRecord.mockResolvedValue({ id: 'r1' });
  m.enforce.mockResolvedValue(undefined);
  m.finishIntakeRecord.mockResolvedValue(undefined);
  mockSession(session);
});

describe('intake-submission › POST /api/intake', () => {
  it('refuses a signed-out request and never calls Intake', async () => { await expectUnauthenticated(() => POST(form({ outputType: 'Cart' }, [pdf])), m.callIntake); });
  it('refuses a session without a business unit', async () => { await expectNoBusinessUnit(() => POST(form({ outputType: 'Cart' }, [pdf])), m.callIntake); });

  it('answers 202 with a processing record before Intake runs', async () => {
    const res = await POST(form({ outputType: 'Cart' }, [pdf]));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ id: 'r1' });
    expect(m.createIntakeRecord).toHaveBeenCalledWith('mpw-co', expect.objectContaining({ outputType: 'Cart', fileNames: ['po.pdf'], customerId: 'c1' }));
    expect(m.callIntake).not.toHaveBeenCalled();
  });

  it('records the entity reference when Intake succeeds', async () => {
    m.callIntake.mockResolvedValue({ ok: true, entity: { type: 'Cart', id: 'cart-1' }, warnings: ['ProductsNotFound'] });
    await POST(form({ outputType: 'Cart' }, [pdf]));
    await runLater();
    expect(m.finishIntakeRecord).toHaveBeenCalledWith('mpw-co', 'r1', { status: 'done', entity: { type: 'Cart', id: 'cart-1' }, warnings: ['ProductsNotFound'] });
  });

  it('records the code and a safe message when Intake refuses', async () => {
    m.callIntake.mockResolvedValue({ ok: false, code: 'NoLineItemsExtracted', message: 'We could not find any products in your input.' });
    await POST(form({ outputType: 'Cart' }, [pdf]));
    await runLater();
    expect(m.finishIntakeRecord).toHaveBeenCalledWith('mpw-co', 'r1', expect.objectContaining({ status: 'failed', errorCode: 'NoLineItemsExtracted' }));
  });

  it('records a failure when the call itself throws', async () => {
    m.callIntake.mockRejectedValue(new Error('network'));
    await POST(form({ outputType: 'Cart' }, [pdf]));
    await runLater();
    expect(m.finishIntakeRecord).toHaveBeenCalledWith('mpw-co', 'r1', expect.objectContaining({ status: 'failed', errorCode: 'IntakeUnavailable', errorMessage: 'network' }));
  });

  it('takes identity from the session, not from the body', async () => {
    m.callIntake.mockResolvedValue({ ok: true, entity: { type: 'Cart', id: 'c' }, warnings: [] });
    await POST(form({ outputType: 'Cart', text: '5 x pipe', email: 'evil@x.co', businessUnitKey: 'other' }));
    await runLater();
    const sent = m.callIntake.mock.calls[0]![0] as { prompt: string; outputType: string };
    expect(sent.prompt).toContain('ada@acme.co');
    expect(sent.prompt).toContain('mpw-co');
    expect(sent.prompt).not.toMatch(/evil@x\.co|other/);
    expect(sent.outputType).toBe('Cart');
  });

  it('sends the list name for a shopping list', async () => {
    m.callIntake.mockResolvedValue({ ok: true, entity: { type: 'ShoppingList', id: 's' }, warnings: [] });
    await POST(form({ outputType: 'ShoppingList', listName: 'Q3 restock', text: '12 x ABC-123' }));
    await runLater();
    expect((m.callIntake.mock.calls[0]![0] as { prompt: string }).prompt).toContain('Shopping list name: "Q3 restock"');
  });

  it.each([
    ['nothing to submit', { outputType: 'Cart' }, []],
    ['shopping list without a name', { outputType: 'ShoppingList', text: 'x' }, []],
    ['unsupported file', { outputType: 'Cart' }, [new File(['x'], 'photo.png')]],
    ['four files', { outputType: 'Cart' }, ['a', 'b', 'c', 'd'].map((n) => new File(['x'], `${n}.pdf`))],
  ])('rejects %s with 400 and calls nothing', async (_name, fields, files) => {
    const res = await POST(form(fields, files));
    expect(res.status).toBe(400);
    expect(m.createIntakeRecord).not.toHaveBeenCalled();
    expect(m.callIntake).not.toHaveBeenCalled();
  });
});

describe('intake-history › GET /api/intake', () => {
  it('lists the session unit’s records', async () => {
    m.listIntakeRecords.mockResolvedValue([{ id: 'r1' }]);
    const res = await GET();
    expect(await res.json()).toEqual({ intakes: [{ id: 'r1' }] });
    expect(m.listIntakeRecords).toHaveBeenCalledWith('mpw-co');
  });
  it('refuses a signed-out request', async () => { await expectUnauthenticated(() => GET(), m.listIntakeRecords); });
});
