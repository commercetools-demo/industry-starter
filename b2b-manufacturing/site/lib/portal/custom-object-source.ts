import 'server-only';
import { fetchRecords, fetchSiteNames, CONTAINERS, type InvoiceRecord, type VisitRecord, type WasteDocRecord } from '@/lib/ct/portal-data';
import { DOC_TYPE } from './documents';
import type { Alert, Invoice, PortalDataSource, Visit, WasteDocument } from './data-source';

/** `pipe-installation-repair` becomes `Pipe installation repair` (the page swaps in the localized service name). */
export const humanize = (slug: string): string => { const s = slug.replace(/-/g, ' ').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };

type Sites = Record<string, string>;
const siteName = (sites: Sites, key: string) => sites[key] ?? key;

export const mapVisit = (r: VisitRecord, sites: Sites): Visit => ({ id: r.id, date: r.date, siteKey: r.siteKey, siteName: siteName(sites, r.siteKey), service: humanize(r.serviceSlug), serviceSlug: r.serviceSlug, status: r.status, reportNumber: r.reportNumber, reportUrl: `/api/portal/visits/${r.id}` });
const KIND: Record<WasteDocRecord['type'], WasteDocument['kind']> = { 'Waste transfer note': 'Transfer note', 'Consignment note': 'Consignment note', 'Annual report': 'Annual report' };
export const mapWasteDoc = (r: WasteDocRecord, sites: Sites): WasteDocument => ({ id: r.id, number: r.number, kind: KIND[r.type] ?? 'Transfer note', date: r.date, siteKey: r.siteKey, siteName: siteName(sites, r.siteKey), wasteType: r.wasteType, recycledKg: r.recycledKg, totalKg: r.totalKg, fileUrl: `/api/portal/documents/${DOC_TYPE[KIND[r.type] ?? 'Transfer note']}/${r.id}` });
export const mapInvoice = (r: InvoiceRecord, sites: Sites): Invoice => ({ id: r.id, number: r.number, date: r.date, siteKey: r.siteKey, siteName: siteName(sites, r.siteKey), amountCents: r.amountPence, currency: 'USD', status: r.status, pdfUrl: `/api/portal/invoices/${r.id}` });

/** Missed visits raise a missed-collection alert. (The seed holds no certificates, so there is no expiring-certificate alert yet.) */
export const deriveAlerts = (visits: Visit[]): Alert[] =>
  visits.filter((v) => v.status === 'Missed').map((v) => ({ id: `missed-${v.id}`, kind: 'missed-collection' as const, date: v.date, message: `Missed visit: ${v.service}, ${v.siteName}` }));

const byDateDesc = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date);

export const customObjectSource: PortalDataSource = {
  async visits(bu) { const [recs, sites] = await Promise.all([fetchRecords<VisitRecord>(CONTAINERS.visits, bu), fetchSiteNames(bu)]); return recs.map((r) => mapVisit(r, sites)).sort(byDateDesc); },
  async wasteDocs(bu) { const [recs, sites] = await Promise.all([fetchRecords<WasteDocRecord>(CONTAINERS.wasteDocs, bu), fetchSiteNames(bu)]); return recs.map((r) => mapWasteDoc(r, sites)).sort(byDateDesc); },
  async invoices(bu) { const [recs, sites] = await Promise.all([fetchRecords<InvoiceRecord>(CONTAINERS.invoices, bu), fetchSiteNames(bu)]); return recs.map((r) => mapInvoice(r, sites)).sort(byDateDesc); },
  async alerts(bu) { return deriveAlerts(await customObjectSource.visits(bu)); },
};
