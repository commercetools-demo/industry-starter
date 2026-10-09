import { DEMO_COMPANIES } from './demo';
import { SERVICES } from './services';

/** Demo data for the client portal (D5/Q-020): stored as Custom Objects, one set per company, deterministic. */
export const CONTAINERS = { visits: 'mpw-visits', wasteDocs: 'mpw-waste-docs', invoices: 'mpw-invoices' } as const;

export type VisitStatus = 'Scheduled' | 'In progress' | 'Completed' | 'Missed';
export type InvoiceStatus = 'Paid' | 'Due' | 'Overdue';

export interface VisitRecord { id: string; date: string; siteKey: string; serviceSlug: string; status: VisitStatus; reportNumber: string }
export interface WasteDocRecord { id: string; date: string; siteKey: string; type: 'Waste transfer note' | 'Consignment note' | 'Annual report'; wasteType: string; number: string; recycledKg: number; totalKg: number }
export interface InvoiceRecord { id: string; number: string; date: string; siteKey: string; amountPence: number; status: InvoiceStatus }

export interface CustomObjectSeed { container: string; key: string; value: unknown }

const iso = (daysFromBase: number) => new Date(Date.UTC(2026, 9, 8) + daysFromBase * 86_400_000).toISOString().slice(0, 10);
const slugs = SERVICES.map((s) => s.slug);
const statuses: VisitStatus[] = ['Completed', 'Completed', 'Completed', 'Missed', 'Completed', 'In progress', 'Scheduled', 'Scheduled'];

export function buildPortalDemo(): CustomObjectSeed[] {
  const out: CustomObjectSeed[] = [];
  for (const company of DEMO_COMPANIES) {
    const sites = company.sites.map((s) => s.key);
    const big = company.key === 'mpw-demo-co';
    const visitCount = big ? 12 : 4;
    for (let i = 0; i < visitCount; i += 1) {
      const rec: VisitRecord = {
        id: `v${String(i + 1).padStart(3, '0')}`,
        date: iso(-60 + i * 9),
        siteKey: sites[i % sites.length] ?? sites[0] ?? '',
        serviceSlug: slugs[(i * 5 + (big ? 0 : 2)) % slugs.length] ?? 'recycling',
        status: statuses[i % statuses.length] ?? 'Completed',
        reportNumber: `${company.key.toUpperCase()}-VR-${1000 + i}`,
      };
      out.push({ container: CONTAINERS.visits, key: `${company.key}.${rec.id}`, value: rec });
    }
    const docTypes: WasteDocRecord['type'][] = ['Waste transfer note', 'Consignment note', 'Waste transfer note', 'Annual report'];
    const docCount = big ? 8 : 3;
    for (let i = 0; i < docCount; i += 1) {
      const total = 800 + i * 140 + (big ? 0 : 55);
      const rec: WasteDocRecord = {
        id: `d${String(i + 1).padStart(3, '0')}`,
        date: iso(-75 + i * 10),
        siteKey: sites[i % sites.length] ?? sites[0] ?? '',
        type: docTypes[i % docTypes.length] ?? 'Waste transfer note',
        wasteType: ['General', 'Mixed recycling', 'Hazardous (oils)', 'Cardboard'][i % 4] ?? 'General',
        number: `${company.key.toUpperCase()}-WN-${2000 + i}`,
        recycledKg: Math.round(total * (0.62 + (i % 4) * 0.05)),
        totalKg: total,
      };
      out.push({ container: CONTAINERS.wasteDocs, key: `${company.key}.${rec.id}`, value: rec });
    }
    const invStatus: InvoiceStatus[] = ['Paid', 'Paid', 'Paid', 'Paid', 'Due', 'Overdue'];
    const invCount = big ? 6 : 2;
    for (let i = 0; i < invCount; i += 1) {
      const rec: InvoiceRecord = {
        id: `i${String(i + 1).padStart(3, '0')}`,
        number: `${company.key.toUpperCase()}-INV-${3000 + i}`,
        date: iso(-150 + i * 28),
        siteKey: sites[i % sites.length] ?? sites[0] ?? '',
        amountPence: 184_500 + i * 21_250,
        status: invStatus[i % invStatus.length] ?? 'Paid',
      };
      out.push({ container: CONTAINERS.invoices, key: `${company.key}.${rec.id}`, value: rec });
    }
  }
  return out;
}
