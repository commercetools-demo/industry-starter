/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { ViewerProvider } from '@/context/ViewerContext';
import type { Viewer } from '@/lib/portal/types';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { CsvImport } from './CsvImport';
import { ImportPage } from './ImportPage';
import { LocalProductForm } from './LocalProductForm';
import { LocalProductList } from './LocalProductList';

const state = vi.hoisted(() => ({
  products: [] as unknown[],
  create: vi.fn(),
  validate: vi.fn(),
  commit: vi.fn(),
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/marketingApi', () => ({
  useCategories: () => ({ data: { categories: [{ id: 'c1', key: 'mau-cat-brakes', name: { 'en-US': 'Brakes' } }] } }),
  useVehicles: () => ({ data: { vehicles: [{ fitmentKey: 'VW|Golf|2012|2019|1.4 TSI', label: 'Volkswagen Golf VII 1.4 TSI (2012-2019)' }, { fitmentKey: 'Audi|A3|2012|2020|2.0 TDI', label: 'Audi A3 8V 2.0 TDI (2012-2020)' }] } }),
  useLocalProducts: () => ({ data: { products: state.products }, isLoading: false, error: undefined }),
  localApi: { create: (...a: unknown[]) => state.create(...a) },
  importApi: { validate: (...a: unknown[]) => state.validate(...a), commit: (...a: unknown[]) => state.commit(...a) },
}));

const viewer: Viewer = { customerId: 'c1', name: 'N T', email: 'n@example.com', roles: ['admin'], ctPermissions: [], businessUnitKey: 'bu-1', businessUnitName: 'Garage Nord', storeKey: 'store-a', storeName: 'DACH Online' };

function screenOf(ui: ReactNode) {
  return renderWithProviders(
    <ViewerProvider viewer={viewer}>
      <ToastProvider>{ui}</ToastProvider>
    </ViewerProvider>,
    { locale: 'en-US', messages: en },
  );
}

beforeEach(() => {
  state.products = [];
  state.create.mockReset();
  state.validate.mockReset();
  state.commit.mockReset();
});

async function fill(user: ReturnType<typeof userEvent.setup>, sku = 'TST-W-001') {
  await user.type(screen.getByLabelText('Name (Deutsch)'), 'TST-W Bremsenreiniger');
  await user.type(screen.getByLabelText('Name (English)'), 'TST-W Brake cleaner');
  await user.type(screen.getByLabelText('SKU'), sku);
  await user.type(screen.getByLabelText('Price (EUR)'), '12.90');
  await user.selectOptions(screen.getByLabelText('Category'), 'mau-cat-brakes');
}

describe('LocalProductForm', () => {
  it('saves a part without a claim and says it is live', async () => {
    state.create.mockResolvedValue({ ok: true, status: 201, data: { key: 'k', sku: 'TST-W-001', status: 'live' } });
    const user = userEvent.setup();
    screenOf(<LocalProductForm />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => expect(state.create).toHaveBeenCalledTimes(1));
    expect(state.create).toHaveBeenCalledWith('store-a', { name: { 'de-DE': 'TST-W Bremsenreiniger', 'en-US': 'TST-W Brake cleaner' }, sku: 'TST-W-001', priceCents: 1290, categoryKey: 'mau-cat-brakes', type: 'Local part' });
    expect((await screen.findAllByText('Saved. It is live in your store.')).length).toBeGreaterThan(0);
  });

  it('a duplicate SKU shows the field error under the SKU field', async () => {
    state.create.mockResolvedValue({ ok: false, status: 409, data: null, code: 'SKU_IN_USE', details: { field: 'sku' } });
    const user = userEvent.setup();
    screenOf(<LocalProductForm />);
    await fill(user, 'SK-2002');
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    const error = await screen.findByText('SKU already in use');
    expect(screen.getByLabelText('SKU')).toHaveAttribute('aria-describedby', error.id);
    expect(screen.getByLabelText('SKU')).toBeInvalid();
  });

  it('a fitment claim is sent with the chosen vehicles and shows the Awaiting Malva review notice', async () => {
    state.create.mockResolvedValue({ ok: true, status: 201, data: { key: 'k', sku: 'TST-W-001', status: 'pending' } });
    const user = userEvent.setup();
    screenOf(<LocalProductForm />);
    await fill(user);
    await user.click(screen.getByRole('checkbox', { name: /Volkswagen Golf VII/ }));
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => expect(state.create).toHaveBeenCalled());
    expect(state.create.mock.calls[0][1]).toMatchObject({ fitment: ['VW|Golf|2012|2019|1.4 TSI'] });
    expect((await screen.findAllByText('Awaiting Malva review; it appears in listings after approval')).length).toBeGreaterThan(0);
  });

  it('filters the vehicle list by text', async () => {
    const user = userEvent.setup();
    screenOf(<LocalProductForm />);
    await user.type(screen.getByLabelText('Search vehicles'), 'audi');
    expect(screen.queryByRole('checkbox', { name: /Volkswagen/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Audi A3/ })).toBeInTheDocument();
  });

  it('the Bundle type links to the Bundles page and disables Save', async () => {
    const user = userEvent.setup();
    screenOf(<LocalProductForm />);
    await user.selectOptions(screen.getByLabelText('Product type'), 'Bundle');
    expect(screen.getByRole('link', { name: 'Create bundles on the Bundles page' })).toHaveAttribute('href', '/bundles');
    expect(screen.getByRole('button', { name: 'Save product' })).toBeDisabled();
  });

  it('refuses a price of 0 and a missing category before calling the api', async () => {
    const user = userEvent.setup();
    screenOf(<LocalProductForm />);
    await user.type(screen.getByLabelText('Name (Deutsch)'), 'Bremsenreiniger');
    await user.type(screen.getByLabelText('Name (English)'), 'Brake cleaner');
    await user.type(screen.getByLabelText('SKU'), 'TST-W-003');
    await user.type(screen.getByLabelText('Price (EUR)'), '0');
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByText('Enter a price above zero with at most two decimals.')).toBeInTheDocument();
    expect(screen.getByText('Choose a category.')).toBeInTheDocument();
    expect(state.create).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = screenOf(<LocalProductForm />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

const report = (over: Record<string, unknown> = {}) => ({
  rows: 120,
  valid: 112,
  warnings: 6,
  errors: 2,
  importable: 118,
  mapping: [
    { header: 'sku', target: 'sku' },
    { header: 'fitment', target: null, warning: "Fitment can't be imported; add it per product for Malva review" },
    { header: 'colour', target: null },
  ],
  issues: [
    { row: 120, column: 'price', message: 'The price must be above zero with a point and at most two decimals', effect: 'Skipped' },
    { row: 5, column: 'name.de-DE', message: 'The de-DE name is missing; the other language is used', effect: 'Default used' },
  ],
  ...over,
});

async function chooseFile(csv = 'sku,price\nTST-W-1,1.00') {
  const input = screen.getByLabelText('CSV file') as HTMLInputElement;
  const file = new File([csv], 'products.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: async () => csv });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText('products.csv');
}

describe('CsvImport', () => {
  it('shows the summary chips, the mapping and the issue list; nothing is committed before the button', async () => {
    state.validate.mockResolvedValue({ ok: true, status: 200, data: report() });
    const user = userEvent.setup();
    screenOf(<CsvImport />);
    expect(screen.getByRole('button', { name: 'Validate file' })).toBeDisabled();
    await chooseFile();
    await user.click(screen.getByRole('button', { name: 'Validate file' }));
    const summary = await screen.findByRole('list', { name: 'Validation summary' });
    expect(summary).toHaveTextContent('Rows 120');
    expect(summary).toHaveTextContent('Valid 112');
    expect(summary).toHaveTextContent('Warnings 6');
    expect(summary).toHaveTextContent('Errors 2');
    expect(screen.getByRole('button', { name: 'Import 118 rows' })).toBeEnabled();
    expect(screen.getByText('Skipped')).toBeInTheDocument();
    expect(screen.getByText('Default used')).toBeInTheDocument();
    expect(state.validate).toHaveBeenCalledWith('store-a', 'sku,price\nTST-W-1,1.00', {});
    expect(state.commit).not.toHaveBeenCalled();
  });

  it('the fitment column is Unmapped with the warning and has no target choice; another unmapped column can be ignored or mapped, and re-validates', async () => {
    state.validate.mockResolvedValue({ ok: true, status: 200, data: report() });
    const user = userEvent.setup();
    screenOf(<CsvImport />);
    await chooseFile();
    await user.click(screen.getByRole('button', { name: 'Validate file' }));
    await screen.findByRole('list', { name: 'Validation summary' });
    expect(screen.getByText("Fitment can't be imported; add it per product for Malva review")).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Map column fitment' })).not.toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: 'Map column colour' });
    expect(within(select).getByRole('option', { name: 'Ignore' })).toBeInTheDocument();
    await user.selectOptions(select, 'description.en-US');
    await waitFor(() => expect(state.validate).toHaveBeenCalledTimes(2));
    expect(state.validate).toHaveBeenLastCalledWith('store-a', 'sku,price\nTST-W-1,1.00', { colour: 'description.en-US' });
  });

  it('Import commits the same file and shows the result with the failed rows', async () => {
    state.validate.mockResolvedValue({ ok: true, status: 200, data: report() });
    state.commit.mockResolvedValue({ ok: true, status: 200, data: { imported: 117, failed: [{ sku: 'TST-W-9', error: 'slug already in use' }], skipped: 2, containers: [] } });
    const user = userEvent.setup();
    screenOf(<CsvImport />);
    await chooseFile();
    await user.click(screen.getByRole('button', { name: 'Validate file' }));
    await user.click(await screen.findByRole('button', { name: 'Import 118 rows' }));
    await waitFor(() => expect(state.commit).toHaveBeenCalledWith('store-a', 'sku,price\nTST-W-1,1.00', {}));
    const status = (await screen.findByText('Imported 117, failed 1')).closest('div') as HTMLElement;
    expect(status).toHaveTextContent('Imported 117, failed 1');
    expect(status).toHaveTextContent('TST-W-9: slug already in use');
  });

  it('nothing importable disables the button; a bad file shows its message', async () => {
    state.validate.mockResolvedValueOnce({ ok: true, status: 200, data: report({ importable: 0, valid: 0, warnings: 0, errors: 3 }) });
    const user = userEvent.setup();
    screenOf(<CsvImport />);
    await chooseFile();
    await user.click(screen.getByRole('button', { name: 'Validate file' }));
    expect(await screen.findByRole('button', { name: 'Import 0 rows' })).toBeDisabled();
    state.validate.mockResolvedValueOnce({ ok: false, status: 400, data: null, code: 'TOO_MANY_ROWS' });
    await user.click(screen.getByRole('button', { name: 'Validate file' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The file has more than 2,000 rows.');
  });

  it('has no accessibility violations', async () => {
    state.validate.mockResolvedValue({ ok: true, status: 200, data: report() });
    const user = userEvent.setup();
    const { container } = screenOf(<CsvImport />);
    await chooseFile();
    await user.click(screen.getByRole('button', { name: 'Validate file' }));
    await screen.findByRole('list', { name: 'Validation summary' });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LocalProductList', () => {
  const rows = [
    { key: 'local-a', sku: 'TST-W-001', name: { 'en-US': 'Brake cleaner' }, priceCents: 1290, status: 'Live', claimedVehicles: [] },
    { key: 'local-b', sku: 'TST-W-002', name: { 'en-US': 'Roof rack' }, priceCents: 12900, status: 'Awaiting review', claimedVehicles: ['Volkswagen|Golf|2012|2019|1.4 TSI'] },
    { key: 'local-c', sku: 'TST-W-003', name: { 'en-US': 'Mats' }, priceCents: null, status: 'Rejected', claimedVehicles: [] },
  ];

  it('shows name, SKU, price, status chips and the claimed vehicles', () => {
    state.products = rows;
    screenOf(<LocalProductList />);
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Awaiting review')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('€129.00')).toBeInTheDocument();
    expect(screen.getByText('Volkswagen Golf 2012 2019 1.4 TSI')).toBeInTheDocument();
  });

  it('highlights and focuses the row named by the key', () => {
    state.products = rows;
    screenOf(<LocalProductList highlightKey="local-b" />);
    const row = screen.getByText('TST-W-002').closest('tr') as HTMLElement;
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(row).toHaveFocus();
    expect((screen.getByText('TST-W-001').closest('tr') as HTMLElement).getAttribute('aria-current')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    state.products = rows;
    const { container } = screenOf(<LocalProductList highlightKey="local-b" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ImportPage', () => {
  it('opens on the tab named by the URL and switches tabs with the keyboard', async () => {
    state.products = [];
    const user = userEvent.setup();
    screenOf(<ImportPage initialTab="local" highlightKey="x" />);
    expect(screen.getByRole('tab', { name: 'Local products' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Your local products' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Add one' }));
    expect(screen.getByRole('heading', { name: 'Add a local product' })).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'CSV import' })).toHaveAttribute('aria-selected', 'true');
  });
});
