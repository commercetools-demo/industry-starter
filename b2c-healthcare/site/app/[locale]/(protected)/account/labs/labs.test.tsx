import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LabDetailView } from '@/lib/account-types';
import messages from '@/messages/en-US.json';
import { setPathname } from '@/test/navigation-mock';
import { renderWithProviders, screen, within } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async (arg: string | { namespace: string }) =>
    createTranslator({ locale: 'en-US', messages, namespace: (typeof arg === 'string' ? arg : arg.namespace) as 'account' }),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>())),
  notFound: () => notFound(),
}));
const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
const labs = { list: vi.fn(), detail: vi.fn() };
vi.mock('@/lib/ct/account-labs', () => ({ listLabs: (...a: unknown[]) => labs.list(...a), getLabDetail: (...a: unknown[]) => labs.detail(...a) }));

import LabsPage from './page';
import LabDetailPage from './[id]/page';
import AccountNotFound from '../not-found';

const item = (id: string, name: string, status: 'ready' | 'processing', collectedAt: string, laboratory: string) => ({ id, name, status, collectedAt, laboratory });
const list = [
  item('LAB-50305', 'Thyroid panel (TSH)', 'processing', '2026-10-06', 'Labcorp · Chelsea'),
  item('LAB-50301', 'Complete blood count', 'ready', '2026-10-03', 'Quest Diagnostics · Midtown'),
];
const lipid: LabDetailView = {
  id: 'LAB-50302', name: 'Lipid panel', status: 'ready', collectedAt: '2026-09-24', laboratory: 'Quest Diagnostics · Midtown',
  note: 'LDL cholesterol is above the target.', orderedByDoctorKey: 'mlv-doc-sofia-marchetti', orderedByName: 'Dr. Sofia Marchetti',
  results: [
    { name: 'LDL cholesterol', value: 148, unit: 'mg/dL', low: 0, high: 100, flag: 'high' },
    { name: 'HDL cholesterol', value: 52, unit: 'mg/dL', low: 40, high: 100, flag: 'normal' },
    { name: 'Vitamin D', value: 19, unit: 'ng/mL', low: 30, high: 100, flag: 'low' },
  ],
};
const thyroid: LabDetailView = { ...lipid, id: 'LAB-50305', name: 'Thyroid panel (TSH)', status: 'processing', note: 'Your sample was received.', results: [] };

const renderList = async () => renderWithProviders(<>{await LabsPage({ params: Promise.resolve({ locale: 'en-US' }) })}</>);
const renderDetail = async (id = 'LAB-50302') => renderWithProviders(<>{await LabDetailPage({ params: Promise.resolve({ locale: 'en-US', id }) })}</>);

beforeEach(() => {
  getSession.mockReset().mockResolvedValue({ customerId: 'c1' });
  labs.list.mockReset().mockResolvedValue(list);
  labs.detail.mockReset().mockResolvedValue(lipid);
  notFound.mockClear();
  setPathname('/en-US/account/labs');
});

describe('design-account-area: Lab tests', () => {
  it('List: each row is a link with name, "<date> · <laboratory>", a status badge and an arrow', async () => {
    await renderList();
    const rows = screen.getAllByRole('link');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('href', '/en-US/account/labs/LAB-50305');
    expect(within(rows[0]).getByText('Thyroid panel (TSH)')).toBeInTheDocument();
    expect(within(rows[0]).getByText('October 6, 2026 · Labcorp · Chelsea')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Processing')).toHaveAttribute('data-variant', 'wait');
    expect(within(rows[1]).getByText('Results ready')).toHaveAttribute('data-variant', 'ok');
    expect(within(rows[1]).getByText('→')).toBeInTheDocument();
  });

  it('List: a patient without tests sees the empty text, a failing lab source an inline error', async () => {
    labs.list.mockResolvedValue([]);
    await renderList();
    expect(screen.getByText('No lab results yet.')).toBeInTheDocument();
  });

  it('List: a failing lab source shows the inline error instead of crashing the page', async () => {
    labs.list.mockRejectedValue(new Error('down'));
    await renderList();
    expect(screen.getByText("We couldn't load your lab results. Please try again.")).toBeInTheDocument();
  });

  it('Detail header: back link, name with badge, Collected, Ordered by, Laboratory and the note', async () => {
    await renderDetail();
    expect(screen.getByRole('link', { name: '← All lab tests' })).toHaveAttribute('href', '/en-US/account/labs');
    expect(screen.getByRole('heading', { level: 1, name: 'Lipid panel' })).toBeInTheDocument();
    expect(screen.getByText('Results ready')).toBeInTheDocument();
    expect(screen.getByText('September 24, 2026')).toBeInTheDocument();
    expect(screen.getByText('Dr. Sofia Marchetti')).toBeInTheDocument();
    expect(screen.getByText('Quest Diagnostics · Midtown')).toBeInTheDocument();
    expect(screen.getByText('LDL cholesterol is above the target.')).toBeInTheDocument();
    expect(labs.detail).toHaveBeenCalledWith('c1', 'LAB-50302', expect.objectContaining({ locale: 'en-US' }));
  });

  it('Result table: value with unit, range text ("< N" for a zero low bound), clamped marker and the flag as text', async () => {
    await renderDetail();
    const ldl = screen.getByRole('row', { name: /LDL cholesterol/ });
    expect(within(ldl).getByText('148')).toBeInTheDocument();
    expect(within(ldl).getByText('< 100 mg/dL')).toBeInTheDocument();
    expect(within(ldl).getByText('High')).toHaveAttribute('data-variant', 'no');
    const ldlBar = within(ldl).getByRole('img');
    expect(ldlBar.className).toContain('bg-danger-50');
    expect(ldlBar.getAttribute('aria-label')).toContain('High');
    expect(ldlBar.querySelector('[data-marker]')).toHaveStyle({ left: '96%' });

    const hdl = screen.getByRole('row', { name: /HDL cholesterol/ });
    expect(within(hdl).getByText('40 – 100 mg/dL')).toBeInTheDocument();
    expect(within(hdl).getByText('Normal')).toHaveAttribute('data-variant', 'ok');
    expect(within(hdl).getByRole('img').className).not.toContain('bg-danger-50');

    const low = screen.getByRole('row', { name: /Vitamin D/ });
    expect(within(low).getByText('Low')).toBeInTheDocument();
    expect(within(low).getByRole('img').querySelector('[data-marker]')).toHaveStyle({ left: '4%' });
  });

  it('Processing test: only the header and the note, no table and no actions', async () => {
    labs.detail.mockResolvedValue(thyroid);
    await renderDetail('LAB-50305');
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Your sample was received.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Download PDF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Discuss with a doctor' })).not.toBeInTheDocument();
  });

  it('Actions: Download PDF is an authenticated GET with no values in the URL; Discuss opens the ordering doctor\'s profile', async () => {
    await renderDetail();
    const pdf = screen.getByRole('link', { name: 'Download PDF' });
    expect(pdf).toHaveAttribute('href', '/api/account/labs/LAB-50302/pdf');
    expect(pdf.getAttribute('href')).not.toMatch(/148|LDL|Lipid/);
    expect(screen.getByRole('link', { name: 'Discuss with a doctor' })).toHaveAttribute('href', '/en-US/doctor/mlv-doc-sofia-marchetti');
  });

  it('Unknown or foreign test: both end in notFound() and render the same "Not found." body', async () => {
    labs.detail.mockResolvedValue(null);
    await expect(renderDetail('LAB-50301')).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(renderDetail('l999')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(2);
    renderWithProviders(<AccountNotFound />);
    expect(screen.getByText('Not found.')).toBeInTheDocument();
  });

  it('a signed-out visitor gets the sign-in prompt and no lab read happens', async () => {
    getSession.mockResolvedValue({});
    await renderDetail();
    expect(labs.detail).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    await renderList();
    expect(labs.list).not.toHaveBeenCalled();
  });
});

describe('accessibility (Z sweep)', () => {
  it('the results table can scroll sideways with the keyboard: a labelled, focusable region (axe scrollable-region-focusable)', async () => {
    await renderDetail();
    const region = screen.getByRole('region', { name: /Lab results/ });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(within(region).getByRole('table')).toBeInTheDocument();
  });
});
