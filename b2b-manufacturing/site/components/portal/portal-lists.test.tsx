import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en-US.json';
import deMessages from '@/messages/de-DE.json';
import type { Invoice, Visit, WasteDocument } from '@/lib/portal/data-source';

vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), usePathname: () => '/en-US/account/visits', useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }) }));
const { VisitsList } = await import('./VisitsList');
const { DocumentsList } = await import('./DocumentsList');
const { InvoicesList } = await import('./InvoicesList');

const wrap = (ui: React.ReactNode, locale: 'en-US' | 'de-DE' = 'en-US') => render(<NextIntlClientProvider locale={locale} messages={locale === 'en-US' ? enMessages : deMessages}>{ui}</NextIntlClientProvider>);
const v = (id: string, date: string, siteKey: string, status: Visit['status']): Visit => ({ id, date, siteKey, siteName: siteKey === 's1' ? 'Main plant' : siteKey === 's2' ? 'Depot' : 'Clinic', service: 'Recycling', status, reportUrl: `/api/portal/visits/${id}`, reportNumber: id });
const VISITS = [v('v1', '2026-08-09', 's1', 'Completed'), v('v2', '2026-08-18', 's2', 'Missed'), v('v3', '2026-09-01', 's3', 'Scheduled'), v('v4', '2026-09-10', 's1', 'In progress')];

describe('malva-client-portal › Filter by site', () => {
  it('shows all visits, DD/MM/YYYY dates, a real table with caption and sortable headers', async () => {
    const { container } = wrap(<VisitsList visits={VISITS} params={{}} />);
    const table = screen.getByRole('table', { name: 'Service visits (4)' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(within(table).getByText('09/08/2026')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Date/ })).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByRole('columnheader', { name: 'Report' })).not.toHaveAttribute('aria-sort');
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
  it('a chosen site lists only that site, the filter control reflects it, and sort links keep it in the URL', () => {
    wrap(<VisitsList visits={VISITS} params={{ site: 's1' }} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).queryByText('Depot')).toBeNull();
    expect(screen.getByLabelText('Site')).toHaveValue('s1');
    expect(screen.getByRole('link', { name: 'Sort by Service' })).toHaveAttribute('href', expect.stringContaining('site=s1'));
    expect(screen.getByRole('link', { name: 'Sort by Service' }).getAttribute('href')).toMatch(/sort=service&dir=asc/);
  });
  it('filters by status and ignores an unknown site or status value', () => {
    wrap(<VisitsList visits={VISITS} params={{ status: 'Scheduled' }} />);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
  });
  it('unknown filter values are ignored; no match and empty states have their own text', () => {
    const { unmount } = wrap(<VisitsList visits={VISITS} params={{ site: 'evil"', status: 'x' }} />);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(5);
    unmount();
    wrap(<VisitsList visits={VISITS} params={{ site: 's3', status: 'Missed' }} />);
    expect(screen.getByText('Nothing matches these filters.')).toBeInTheDocument();
  });
  it('empty company: "No service visits yet."', () => {
    wrap(<VisitsList visits={[]} params={{}} />);
    expect(screen.getByText('No service visits yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('sorts by the URL sort and direction', () => {
    wrap(<VisitsList visits={VISITS} params={{ sort: 'site', dir: 'asc' }} />);
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[1]!.textContent);
    expect(rows).toEqual(['Clinic', 'Depot', 'Main plant', 'Main plant']);
    expect(screen.getByRole('columnheader', { name: /Site/ })).toHaveAttribute('aria-sort', 'ascending');
  });
});

describe('malva-client-portal › Missed visit', () => {
  it('carries the danger style and the text Missed, never colour alone; every status has its own text', () => {
    wrap(<VisitsList visits={VISITS} params={{}} />);
    const missed = within(screen.getByRole('table')).getByText('Missed');
    expect(missed.closest('[data-tone]')).toHaveAttribute('data-tone', 'danger');
    expect(within(screen.getByRole('table')).getByText('Scheduled').closest('[data-tone]')).toHaveAttribute('data-tone', 'info');
    expect(within(screen.getByRole('table')).getByText('In progress').closest('[data-tone]')).toHaveAttribute('data-tone', 'warn');
    expect(within(screen.getByRole('table')).getByText('Completed').closest('[data-tone]')).toHaveAttribute('data-tone', 'success');
  });
  it('is in German in the German locale', () => {
    wrap(<VisitsList visits={VISITS} params={{}} />, 'de-DE');
    expect(within(screen.getByRole('table')).getByText('Verpasst')).toBeInTheDocument();
  });
});

const doc = (id: string, kind: WasteDocument['kind'], date: string, siteKey: string, wasteType: string, recycledKg: number, totalKg: number): WasteDocument =>
  ({ id, number: `N-${id}`, kind, date, siteKey, siteName: siteKey === 's1' ? 'Main plant' : 'Depot', wasteType, recycledKg, totalKg, fileUrl: `/api/portal/documents/x/${id}` });
const DOCS = [
  doc('d1', 'Transfer note', '2026-10-03', 's1', 'General', 600, 1000), doc('d2', 'Consignment note', '2026-10-20', 's2', 'Cardboard', 100, 200),
  doc('d3', 'Transfer note', '2026-05-01', 's1', 'General', 300, 800), doc('d4', 'Annual report', '2026-10-05', 's1', 'General', 9999, 9999), doc('d5', 'Transfer note', '2025-09-01', 's1', 'General', 500, 500),
];

describe('malva-client-portal › Download a note', () => {
  it('lists each document with a download link whose name contains the number', () => {
    wrap(<DocumentsList docs={DOCS} params={{}} locale="en-US" />);
    const link = screen.getByRole('link', { name: 'Download document N-d2' });
    expect(link).toHaveAttribute('href', '/api/portal/documents/x/d2');
    expect(link).toHaveAttribute('download');
    expect(screen.getByText('Consignment note', { selector: 'td' })).toBeInTheDocument();
  });
  it('filters by site, waste type and date range from the URL', () => {
    wrap(<DocumentsList docs={DOCS} params={{ site: 's1', wasteType: 'General', from: '2026-06-01', to: '2026-10-31' }} locale="en-US" />);
    const table = screen.getByRole('table', { name: 'Waste documents (2)' });
    expect(within(table).getByText('N-d1')).toBeInTheDocument();
    expect(within(table).queryByText('N-d3')).toBeNull();
    expect(screen.getByLabelText('From date')).toHaveValue('2026-06-01');
  });
});

describe('malva-client-portal › Diversion rate', () => {
  it('shows the month and trailing twelve months with the weights they are computed from', async () => {
    const { container } = wrap(<DocumentsList docs={DOCS} params={{}} locale="en-US" />);
    const summary = screen.getByRole('table', { name: /Diversion rate for October 2026/ });
    const rows = within(summary).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
    expect(rows).toEqual([
      ['October 2026', '700', '1,200', '58.3%'],
      ['Trailing twelve months', '1,000', '2,000', '50%'],
    ]);
    expect(screen.getByText(/recycled weight \/ total weight/)).toBeInTheDocument();
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
  it('another month can be chosen in the URL; a month without data shows no rate', () => {
    wrap(<DocumentsList docs={DOCS} params={{ month: '2026-05' }} locale="en-US" />);
    const summary = screen.getByRole('table', { name: /May 2026/ });
    expect(within(summary).getAllByRole('row')[1]!.textContent).toContain('37.5%');
  });
  it('German formatting', () => {
    wrap(<DocumentsList docs={DOCS} params={{}} locale="de-DE" />, 'de-DE');
    expect(screen.getByRole('cell', { name: /58,3/ })).toBeInTheDocument();
  });
});

const inv = (id: string, status: Invoice['status'], siteKey = 's1'): Invoice => ({ id, number: `INV-${id}`, date: '2026-05-01', siteKey, siteName: 'Main plant', amountCents: 184500, currency: 'USD', status, pdfUrl: `/api/portal/invoices/${id}` });

describe('malva-client-portal › Overdue invoice', () => {
  it('is marked Overdue in text and danger style, shows how to contact accounts, and offers no payment control', async () => {
    const { container } = wrap(<InvoicesList invoices={[inv('1', 'Paid'), inv('2', 'Due'), inv('3', 'Overdue')]} params={{}} locale="en-US" />);
    expect(within(screen.getByRole('table')).getByText('Overdue').closest('[data-tone]')).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByRole('heading', { name: '1 invoice is overdue' })).toBeInTheDocument();
    expect(screen.getByText(/accounts@malva\.example/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /^pay/i })).toBeNull();
    expect(screen.getAllByText('$1,845.00', { selector: 'td' })).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Download invoice INV-3 as PDF' })).toHaveAttribute('href', '/api/portal/invoices/3');
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
  it('no overdue banner when nothing is overdue, but the contact line stays; filters by status', () => {
    wrap(<InvoicesList invoices={[inv('1', 'Paid'), inv('2', 'Due')]} params={{ status: 'Due' }} locale="en-US" />);
    expect(screen.queryByRole('heading', { name: /overdue/i })).toBeNull();
    expect(screen.getByText(/accounts@malva\.example/)).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
  });
  it('empty state', () => {
    wrap(<InvoicesList invoices={[]} params={{}} locale="en-US" />);
    expect(screen.getByText('No invoices yet.')).toBeInTheDocument();
  });
});
