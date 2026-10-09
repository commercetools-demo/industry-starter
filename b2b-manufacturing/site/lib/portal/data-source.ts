import 'server-only';
import { customObjectSource } from './custom-object-source';

export interface Visit { id: string; date: string; siteKey: string; siteName: string; service: string; status: 'Scheduled' | 'In progress' | 'Completed' | 'Missed'; reportUrl?: string; serviceSlug?: string; reportNumber?: string }
export interface WasteDocument { id: string; number: string; kind: 'Transfer note' | 'Consignment note' | 'Annual report'; date: string; siteKey: string; siteName: string; wasteType: string; fileUrl?: string; recycledKg?: number; totalKg?: number }
export interface Invoice { id: string; number: string; date: string; siteKey: string; siteName: string; amountCents: number; currency: string; status: 'Paid' | 'Due' | 'Overdue'; pdfUrl?: string }
export interface Alert { id: string; kind: 'expiring-certificate' | 'missed-collection'; message: string; date: string }

/** Everything the portal reads that is not commercetools commerce data. Implemented in workstream T with Custom Objects. */
export interface PortalDataSource {
  visits(businessUnitKey: string): Promise<Visit[]>;
  wasteDocs(businessUnitKey: string): Promise<WasteDocument[]>;
  invoices(businessUnitKey: string): Promise<Invoice[]>;
  alerts(businessUnitKey: string): Promise<Alert[]>;
}

export const emptyDataSource: PortalDataSource = {
  visits: async () => [], wasteDocs: async () => [], invoices: async () => [], alerts: async () => [],
};

let current: PortalDataSource | undefined;
/** The injected source, otherwise the Custom Object source (workstream T). */
export const getPortalData = (): PortalDataSource => (current ??= customObjectSource);
/** Exported so tests can inject a source. */
export const setPortalDataSource = (source: PortalDataSource): void => { current = source; };
