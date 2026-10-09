// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoBusinessUnit, expectUnauthenticated, mockSession, sessionMock } from '../../../test/api-helpers';

const fetchRecords = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: async () => sessionMock.current }));
vi.mock('@/lib/ct/portal-data', () => ({
  CONTAINERS: { visits: 'mpw-visits', wasteDocs: 'mpw-waste-docs', invoices: 'mpw-invoices' },
  fetchSiteNames: async () => ({ s1: 'Main plant' }),
  // Each company has its own records; the route can only ever see the ones of the unit it is asked for.
  fetchRecords: (container: string, bu: string) => fetchRecords(container, bu),
}));
const { GET: getDoc } = await import('./documents/[type]/[id]/route');
const { GET: getVisit } = await import('./visits/[id]/route');
const { GET: getInvoice } = await import('./invoices/[id]/route');

const DATA: Record<string, Record<string, unknown[]>> = {
  mine: {
    'mpw-waste-docs': [{ id: 'd001', date: '2026-07-25', siteKey: 's1', type: 'Consignment note', wasteType: 'General', number: 'MINE-WN-2000', recycledKg: 600, totalKg: 1000 }],
    'mpw-visits': [{ id: 'v001', date: '2026-08-09', siteKey: 's1', serviceSlug: 'recycling', status: 'Completed', reportNumber: 'MINE-VR-1000' }],
    'mpw-invoices': [{ id: 'i001', number: 'MINE-INV-3000', date: '2026-05-01', siteKey: 's1', amountPence: 184500, status: 'Overdue' }],
  },
  other: { 'mpw-waste-docs': [{ id: 'd009', date: '2026-07-25', siteKey: 's9', type: 'Consignment note', wasteType: 'General', number: 'OTHER-WN-1', recycledKg: 1, totalKg: 2 }], 'mpw-visits': [], 'mpw-invoices': [] },
};
beforeEach(() => { fetchRecords.mockReset(); fetchRecords.mockImplementation(async (c: string, bu: string) => DATA[bu]?.[c] ?? []); mockSession({ customerId: 'c1', businessUnitKey: 'mine' }); });
const call = (h: typeof getDoc, params: Record<string, string>) => (h as unknown as (r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>)(new Request('http://x/api/portal'), { params: Promise.resolve(params) });
const bytes = async (r: Response) => Buffer.from(await r.arrayBuffer());

describe('malva-client-portal › Download a note', () => {
  it('delivers a PDF named with the note number and date, as an attachment, never cached', async () => {
    const res = await call(getDoc, { type: 'consignment-note', id: 'd001' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="consignment-note-MINE-WN-2000-2026-07-25.pdf"');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await bytes(res);
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(body.toString('latin1')).toContain('MINE-WN-2000');
    expect(body.toString('latin1')).toContain('%%EOF');
  });
  it('names a visit report and an invoice with number and date too', async () => {
    expect((await call(getVisit as never, { id: 'v001' })).headers.get('Content-Disposition')).toContain('filename="visit-report-MINE-VR-1000-2026-08-09.pdf"');
    expect((await call(getInvoice as never, { id: 'i001' })).headers.get('Content-Disposition')).toContain('filename="invoice-MINE-INV-3000-2026-05-01.pdf"');
  });
  it('reads only the session unit, never a unit named in the request', async () => {
    await call(getDoc, { type: 'consignment-note', id: 'd001' });
    expect(fetchRecords.mock.calls.every(([, bu]) => bu === 'mine')).toBe(true);
  });
});

describe("malva-client-portal › Another company's document", () => {
  const missing = async () => { const r = await call(getDoc, { type: 'consignment-note', id: 'nope' }); return { status: r.status, body: await r.text() }; };
  it('another company id (Custom Object key or its short id) answers exactly like a missing one', async () => {
    const expected = await missing();
    expect(expected.status).toBe(404);
    for (const params of [{ type: 'consignment-note', id: 'other.d009' }, { type: 'consignment-note', id: 'd009' }, { type: 'consignment-note', id: 'other.d001' }]) {
      const r = await call(getDoc, params);
      expect({ status: r.status, body: await r.text() }).toEqual(expected);
    }
    expect(fetchRecords.mock.calls.every(([, bu]) => bu === 'mine')).toBe(true);
  });
  it('404 for a wrong type, a malformed id, and other companies visits and invoices', async () => {
    for (const params of [{ type: 'transfer-note', id: 'd001' }, { type: 'x', id: 'd001' }, { type: 'consignment-note', id: '../d001' }, { type: 'consignment-note', id: 'mine.' }]) expect((await call(getDoc, params)).status).toBe(404);
    expect((await call(getVisit as never, { id: 'other.v001' })).status).toBe(404);
    expect((await call(getInvoice as never, { id: 'other.i001' })).status).toBe(404);
  });
  it('401 without a session and 400 without a unit, with no data read', async () => {
    const h = () => call(getDoc, { type: 'consignment-note', id: 'd001' });
    await expectUnauthenticated(h as never, fetchRecords);
    await expectNoBusinessUnit(h as never, fetchRecords);
  });
});
