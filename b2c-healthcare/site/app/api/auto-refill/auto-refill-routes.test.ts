// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeJsonRequest } from '@/test/request';

const session = vi.hoisted(() => ({ getSession: vi.fn(), setCart: vi.fn(), clearCart: vi.fn() }));
vi.mock('@/lib/session', () => session);
vi.mock('@/lib/ct/patient', () => ({ getPatient: async () => ({ patientRef: 'pt_sam', name: 'Sam' }) }));
vi.mock('@/lib/checkout/provider', () => ({ getPaymentProvider: async () => ({ kind: 'demo' }) }));

const svc = vi.hoisted(() => ({ enableAutoRefill: vi.fn(), listRefills: vi.fn() }));
vi.mock('@/lib/ct/auto-refill', async () => {
  class AutoRefillError extends Error {
    constructor(readonly code: string, readonly notIncluded: unknown[] = []) {
      super(code);
    }
  }
  return { ...svc, AutoRefillError };
});
const rec = vi.hoisted(() => ({ getOwnRecurring: vi.fn(), pauseRecurring: vi.fn(), resumeRecurring: vi.fn(), skipNextRecurring: vi.fn(), cancelRecurring: vi.fn(), changeScheduleRecurring: vi.fn() }));
vi.mock('@/lib/ct/recurring', async () => {
  class RecurringBusyError extends Error {}
  return { ...rec, RecurringBusyError };
});
const preview = vi.hoisted(() => ({ previewDecision: vi.fn() }));
vi.mock('@/lib/ct/auto-refill-run', () => preview);
vi.mock('@/lib/ct/refill-log', () => ({ lastRunsOf: async () => new Map([['ro1', { runAt: '2026-11-07T05:00:00Z', outcome: 'skipped', reason: 'authorization-expired' }]]) }));

import { AutoRefillError } from '@/lib/ct/auto-refill';
import { RecurringBusyError } from '@/lib/ct/recurring';
import { GET as listGet, POST as enablePost } from './route';
import { PATCH as schedulePatch, POST as actionPost } from './[id]/route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const ro = (state: string, over = {}) => ({ id: 'ro1', recurringOrderState: state, schedule: { type: 'standard', intervalUnit: 'Months', value: 1 }, nextOrderAt: '2026-11-08T10:00:00Z', cart: { id: 'c', obj: { lineItems: [{ name: { 'en-US': 'Atorvastatin' }, quantity: 1, recurrenceInfo: { priceSelectionMode: 'Dynamic' } }] } }, ...over });
const act = (action: string, id = 'ro1') => actionPost(makeJsonRequest(`/api/auto-refill/${id}`, { action }), ctx(id));

beforeEach(() => {
  session.getSession.mockReset().mockResolvedValue({ customerId: 'c1', locale: 'en-US' });
  for (const m of [...Object.values(svc), ...Object.values(rec), ...Object.values(preview)]) m.mockReset();
  rec.getOwnRecurring.mockResolvedValue(ro('Active'));
  preview.previewDecision.mockResolvedValue({ run: true });
});

describe('subscriptions-and-recurring-orders: routes', () => {
  it('401 without a session on every route, before anything is read', async () => {
    session.getSession.mockResolvedValue({});
    const r = await Promise.all([listGet(), enablePost(makeJsonRequest('/api/auto-refill', {})), act('pause'), schedulePatch(makeJsonRequest('/api/auto-refill/ro1', { cadence: 'monthly' }, { method: 'PATCH' }), ctx('ro1'))]);
    expect(r.map((x) => x.status)).toEqual([401, 401, 401, 401]);
    expect(rec.getOwnRecurring).not.toHaveBeenCalled();
  });

  it('GET lists the refills, no-store', async () => {
    svc.listRefills.mockResolvedValue([]);
    const r = await listGet();
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({ refills: [] });
  });

  it('enable: 201 with the refill and what was left out; the RX number is in the body only', async () => {
    svc.enableAutoRefill.mockResolvedValue({ refill: { id: 'ro1' }, notIncluded: [{ name: 'B', reason: 'NO_REFILLS' }] });
    const r = await enablePost(makeJsonRequest('/api/auto-refill', { rxNumber: 'RX-77102', lineRefs: ['a'], cadence: 'monthly' }));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ refill: { id: 'ro1' }, notIncluded: [{ name: 'B', reason: 'NO_REFILLS' }] });
    expect(svc.enableAutoRefill).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'c1', cadence: 'monthly', source: { rxNumber: 'RX-77102', lineRefs: ['a'] } }));
    await enablePost(makeJsonRequest('/api/auto-refill', { orderId: 'o1', cadence: 'quarterly' }));
    expect(svc.enableAutoRefill).toHaveBeenLastCalledWith(expect.objectContaining({ source: { orderId: 'o1' }, cadence: 'quarterly' }));
  });

  it('enable: bad input is 400; the service errors are readable answers (no payment method 409, not dispensable 422 with names)', async () => {
    expect((await enablePost(makeJsonRequest('/api/auto-refill', { rxNumber: 'RX-1', lineRefs: ['a'], cadence: 'weekly' }))).status).toBe(400);
    expect((await enablePost(makeJsonRequest('/api/auto-refill', { rxNumber: 'RX-1', lineRefs: [], cadence: 'monthly' }))).status).toBe(400);
    expect((await enablePost(makeJsonRequest('/api/auto-refill', { orderId: '../x', cadence: 'monthly' }))).status).toBe(400);
    svc.enableAutoRefill.mockRejectedValueOnce(new AutoRefillError('NO_PAYMENT_METHOD'));
    const a = await enablePost(makeJsonRequest('/api/auto-refill', { orderId: 'o1', cadence: 'monthly' }));
    expect(a.status).toBe(409);
    expect(await a.json()).toEqual({ code: 'NO_PAYMENT_METHOD', error: 'Save a payment method first: refills are charged to it.' });
    svc.enableAutoRefill.mockRejectedValueOnce(new AutoRefillError('NOT_DISPENSABLE', [{ name: 'A', reason: 'EXPIRED' }]));
    const b = await enablePost(makeJsonRequest('/api/auto-refill', { orderId: 'o1', cadence: 'monthly' }));
    expect(b.status).toBe(422);
    expect(await b.json()).toMatchObject({ code: 'NOT_DISPENSABLE', notIncluded: [{ name: 'A', reason: 'EXPIRED' }] });
  });

  it('a foreign or unknown auto-refill is the identical 404 for every action and for the schedule', async () => {
    rec.getOwnRecurring.mockResolvedValue(null);
    const bodies = [];
    for (const r of [await act('pause'), await act('resume'), await act('skip'), await act('cancel'), await schedulePatch(makeJsonRequest('/api/auto-refill/x', { cadence: 'monthly' }, { method: 'PATCH' }), ctx('x'))]) {
      expect(r.status).toBe(404);
      bodies.push(JSON.stringify(await r.json()));
    }
    expect(new Set(bodies).size).toBe(1);
    expect(bodies[0]).toContain('Auto-refill not found.');
    expect(rec.pauseRecurring).not.toHaveBeenCalled();
  });

  it('pause, skip and cancel call the module and answer the refill with its last scheduled check', async () => {
    rec.pauseRecurring.mockResolvedValue(ro('Paused'));
    const p = await act('pause');
    expect(p.status).toBe(200);
    expect(await p.json()).toMatchObject({ id: 'ro1', state: 'Paused', nextOrderAt: null, lastRun: { outcome: 'skipped', reason: 'authorization-expired' } });
    rec.skipNextRecurring.mockResolvedValue(ro('Active', { skipConfiguration: { type: 'Counter', totalToSkip: 1, skipped: 0 } }));
    expect(await (await act('skip')).json()).toMatchObject({ skipping: true });
    rec.cancelRecurring.mockResolvedValue(ro('Canceled'));
    expect(await (await act('cancel')).json()).toMatchObject({ state: 'Canceled' });
  });

  it('an action that does not fit the state is a readable 409 and changes nothing; an unknown action is 400', async () => {
    rec.getOwnRecurring.mockResolvedValue(ro('Canceled'));
    for (const a of ['pause', 'resume', 'skip', 'cancel']) {
      const r = await act(a);
      expect(r.status).toBe(409);
      expect((await r.json()).code).toBe('INVALID_STATE');
    }
    expect((await act('explode')).status).toBe(400);
    expect(rec.pauseRecurring).not.toHaveBeenCalled();
  });

  it('resume re-checks the prescription: a lapsed one is refused with the reason, a valid one resumes', async () => {
    rec.getOwnRecurring.mockResolvedValue(ro('Paused'));
    preview.previewDecision.mockResolvedValueOnce({ run: false, action: 'pause', outcome: 'skipped', reason: 'authorization-expired', lineRefs: ['a'] });
    const blocked = await act('resume');
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({ code: 'RESUME_BLOCKED', reason: 'authorization-expired' });
    expect(rec.resumeRecurring).not.toHaveBeenCalled();
    rec.resumeRecurring.mockResolvedValue(ro('Active'));
    expect((await act('resume')).status).toBe(200);
    expect(rec.resumeRecurring).toHaveBeenCalledWith('ro1');
  });

  it('a ceiling does not block a resume (it only skips a run)', async () => {
    rec.getOwnRecurring.mockResolvedValue(ro('Paused'));
    preview.previewDecision.mockResolvedValue({ run: false, action: 'skip', outcome: 'skipped', reason: 'ceiling', lineRefs: ['a'] });
    rec.resumeRecurring.mockResolvedValue(ro('Active'));
    expect((await act('resume')).status).toBe(200);
  });

  it('changing the schedule goes through setSchedule on the same refill; a bad cadence is 400; a busy refill is a retryable 409', async () => {
    rec.changeScheduleRecurring.mockResolvedValue(ro('Active', { schedule: { type: 'standard', intervalUnit: 'Months', value: 3 } }));
    const r = await schedulePatch(makeJsonRequest('/api/auto-refill/ro1', { cadence: 'quarterly' }, { method: 'PATCH' }), ctx('ro1'));
    expect(await r.json()).toMatchObject({ id: 'ro1', cadence: 'quarterly' });
    expect(rec.changeScheduleRecurring).toHaveBeenCalledWith('ro1', 'quarterly');
    expect((await schedulePatch(makeJsonRequest('/api/auto-refill/ro1', { cadence: 'daily' }, { method: 'PATCH' }), ctx('ro1'))).status).toBe(400);
    rec.changeScheduleRecurring.mockRejectedValueOnce(new RecurringBusyError());
    const busy = await schedulePatch(makeJsonRequest('/api/auto-refill/ro1', { cadence: 'monthly' }, { method: 'PATCH' }), ctx('ro1'));
    expect(busy.status).toBe(409);
    expect((await busy.json()).code).toBe('BUSY');
  });

  it('an id that does not have the id shape never reaches commercetools', async () => {
    rec.getOwnRecurring.mockResolvedValue(null);
    expect((await act('pause', '..%2Fx')).status).toBe(404);
  });
});
