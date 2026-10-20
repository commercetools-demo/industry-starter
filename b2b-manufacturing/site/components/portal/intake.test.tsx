/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import type { IntakeRecord } from '@/lib/intake/types';
import { PortalDialogProvider } from '@/context/portal-dialog';

vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), usePathname: () => '/en-US/account/intake', useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }), useParams: () => ({ locale: 'en-US' }) }));
const { IntakeForm } = await import('./IntakeForm');
const { IntakeList } = await import('./IntakeList');
const { IntakeButton } = await import('@/components/layout/IntakeButton');

const ACCOUNT = { customerId: 'c1', email: 'a@b.co', businessUnitKey: 'mpw-co' };
const record = (over: Partial<IntakeRecord>): IntakeRecord => ({ id: 'r1', status: 'done', outputType: 'Cart', fileNames: ['po.pdf'], customerId: 'c1', createdAt: '2026-10-20T10:00:00.000Z', warnings: [], ...over });
let intakes: IntakeRecord[] = [];
const posts: FormData[] = [];
const stub = (account: unknown = ACCOUNT) => vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
  if (url === '/api/auth/me') return account ? Response.json(account) : new Response('{}', { status: 401 });
  if (url === '/api/intake' && init?.method === 'POST') { posts.push(init.body as FormData); return Response.json({ id: 'new' }, { status: 202 }); }
  if (url === '/api/intake') return Response.json({ intakes });
  return new Response('{}', { status: 404 });
}));
const Providers = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale="en-US" messages={messages}>
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><PortalDialogProvider>{children}</PortalDialogProvider></SWRConfig>
  </NextIntlClientProvider>
);
afterEach(() => { vi.unstubAllGlobals(); intakes = []; posts.length = 0; });

describe('intake-navigation › header entry', () => {
  it('shows the Intake link, to the intake page, when signed in', async () => {
    stub();
    render(<Providers><IntakeButton as="link" /></Providers>);
    expect(await screen.findByRole('link', { name: 'Intake' })).toHaveAttribute('href', expect.stringContaining('/account/intake'));
  });
  it('renders nothing for a visitor', async () => {
    stub(null);
    const { container } = render(<Providers><IntakeButton as="link" /></Providers>);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

describe('intake-submission › form', () => {
  it('blocks an empty submission and sends nothing', async () => {
    stub();
    render(<Providers><IntakeForm /></Providers>);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Add a file or describe your order.');
    expect(posts).toHaveLength(0);
  });
  it('shows the list name only for a shopping list, and requires it', async () => {
    stub();
    render(<Providers><IntakeForm /></Providers>);
    expect(screen.queryByLabelText(/Shopping list name/)).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Shopping list' }));
    await userEvent.type(screen.getByLabelText(/Describe your order/), '12 x ABC-123');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Give the shopping list a name.');
  });
  it('refuses a fourth file and an unsupported type, naming the limit or file', async () => {
    stub();
    render(<Providers><IntakeForm /></Providers>);
    const user = userEvent.setup({ applyAccept: false });
    const input = screen.getByLabelText(/Files/);
    await user.upload(input, [new File(['x'], 'photo.png')]);
    expect(await screen.findByRole('alert')).toHaveTextContent('photo.png: this file type is not supported.');
    await user.upload(input, ['a', 'b', 'c', 'd'].map((n) => new File(['x'], `${n}.pdf`)));
    expect(await screen.findByRole('alert')).toHaveTextContent('up to 3 files');
  });
  it('sends outputType, text and files as multipart, then clears the form', async () => {
    stub();
    render(<Providers><IntakeForm /></Providers>);
    await userEvent.upload(screen.getByLabelText(/Files/), new File(['x'], 'po.pdf', { type: 'application/pdf' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Quote request' }));
    await userEvent.type(screen.getByLabelText(/Describe your order/), 'please quote');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]!.get('outputType')).toBe('QuoteRequest');
    expect(posts[0]!.get('text')).toBe('please quote');
    expect((posts[0]!.getAll('files')[0] as File).name).toBe('po.pdf');
    await waitFor(() => expect(screen.getByLabelText(/Describe your order/)).toHaveValue(''));
  });
  it('has no accessibility violations', async () => {
    stub();
    const { container } = render(<Providers><IntakeForm /></Providers>);
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
});

describe('intake-history › list', () => {
  it('shows an empty state', async () => {
    stub();
    render(<Providers><IntakeList /></Providers>);
    expect(await screen.findByText('No intakes yet. Submit one above.')).toBeInTheDocument();
  });
  it('shows In progress, Done with the entity reference, and Failed with its reason', async () => {
    intakes = [
      record({ id: 'a', status: 'processing', createdAt: '2026-10-20T12:00:00.000Z' }),
      record({ id: 'b', status: 'done', outputType: 'QuoteRequest', entity: { type: 'QuoteRequest', id: 'qr-1', cartId: 'cart-9' }, warnings: ['ProductsNotFound'] }),
      record({ id: 'c', status: 'failed', fileNames: [], errorCode: 'NoLineItemsExtracted', errorMessage: 'We could not find any products in your input.' }),
      record({ id: 'd', status: 'failed', errorCode: 'StaleProcessing', errorMessage: 'x' }),
    ];
    stub();
    const { container } = render(<Providers><IntakeList /></Providers>);
    const table = await screen.findByRole('table', { name: 'Recent intakes' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(within(table).getByText('In progress')).toBeInTheDocument();
    expect(within(table).getByText('Quote request qr-1')).toBeInTheDocument();
    expect(within(table).getByText('cart cart-9')).toBeInTheDocument();
    expect(within(table).getByText('Some products were not found')).toBeInTheDocument();
    expect(within(table).getByText('We could not find any products in your input.')).toBeInTheDocument();
    expect(within(table).getByText('Free text')).toBeInTheDocument();
    expect(within(table).getByText('This request did not finish.')).toBeInTheDocument();
    expect(within(table).queryByRole('button')).toBeNull();
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
});
