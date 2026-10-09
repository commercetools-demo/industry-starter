// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchRecords = vi.fn();
const fetchSiteNames = vi.fn();
vi.mock('@/lib/ct/portal-data', () => ({ CONTAINERS: { visits: 'mpw-visits', wasteDocs: 'mpw-waste-docs', invoices: 'mpw-invoices' }, fetchRecords, fetchSiteNames }));
const { customObjectSource, mapVisit, mapWasteDoc, mapInvoice, humanize } = await import('./custom-object-source');
const { getPortalData, setPortalDataSource, emptyDataSource } = await import('./data-source');
beforeEach(() => { fetchRecords.mockReset(); fetchSiteNames.mockReset(); fetchSiteNames.mockResolvedValue({ s1: 'Main plant' }); });

describe('malva-client-portal › Portal data source', () => {
  it('maps the records to app types with the site name, download links, USD cents', async () => {
    expect(mapVisit({ id: 'v1', date: '2026-08-09', siteKey: 's1', serviceSlug: 'pipe-installation-repair', status: 'Missed', reportNumber: 'R1' }, { s1: 'Main plant' }))
      .toMatchObject({ siteName: 'Main plant', service: 'Pipe installation repair', serviceSlug: 'pipe-installation-repair', status: 'Missed', reportUrl: '/api/portal/visits/v1' });
    expect(mapWasteDoc({ id: 'd1', date: '2026-07-25', siteKey: 'zz', type: 'Consignment note', wasteType: 'General', number: 'N1', recycledKg: 5, totalKg: 10 }, {}))
      .toMatchObject({ kind: 'Consignment note', siteName: 'zz', fileUrl: '/api/portal/documents/consignment-note/d1', recycledKg: 5, totalKg: 10 });
    expect(mapInvoice({ id: 'i1', number: 'I1', date: '2026-01-01', siteKey: 's1', amountPence: 184500, status: 'Overdue' }, {})).toMatchObject({ amountCents: 184500, currency: 'USD', pdfUrl: '/api/portal/invoices/i1' });
    expect(humanize('recycling')).toBe('Recycling');
  });
  it('always reads with the business unit it is given, newest first, and derives missed alerts', async () => {
    fetchRecords.mockResolvedValue([
      { id: 'v1', date: '2026-01-01', siteKey: 's1', serviceSlug: 'recycling', status: 'Completed', reportNumber: 'a' },
      { id: 'v2', date: '2026-03-01', siteKey: 's1', serviceSlug: 'recycling', status: 'Missed', reportNumber: 'b' },
    ]);
    const visits = await customObjectSource.visits('my-bu');
    expect(visits.map((v) => v.id)).toEqual(['v2', 'v1']);
    expect(fetchRecords).toHaveBeenCalledWith('mpw-visits', 'my-bu');
    expect(fetchSiteNames).toHaveBeenCalledWith('my-bu');
    expect(await customObjectSource.alerts('my-bu')).toEqual([expect.objectContaining({ kind: 'missed-collection', date: '2026-03-01', message: 'Missed visit: Recycling, Main plant' })]);
  });
  it('is the default source unless one is injected; a company without data gets empty lists', async () => {
    expect(getPortalData()).toBe(customObjectSource);
    fetchRecords.mockResolvedValue([]);
    expect(await getPortalData().invoices('new-co')).toEqual([]);
    setPortalDataSource(emptyDataSource);
    expect(getPortalData()).toBe(emptyDataSource);
  });
});
