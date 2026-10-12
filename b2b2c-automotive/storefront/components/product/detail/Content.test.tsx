// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, renderVehicle, stateOf } from '@/test/vehicle';
import { Description, paragraphsOf } from './Description';
import { RelatedItems } from './RelatedItems';
import { SellerLine } from './SellerLine';
import { Specifications } from './Specifications';
import { detail, GOLF_2016, summary } from './test-fixtures';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/s/p/x',
}));
afterEach(() => vi.unstubAllGlobals());
const render = (ui: ReactNode) => renderVehicle(ui as never, { locale: 'en-US' });

describe('Specifications', () => {
  it('spec rows in order with row headers', () => {
    render(<Specifications specs={detail().specs} />);
    const rows = screen.getAllByRole('row');
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(['Part number', 'Brand', 'Warranty (months)']);
    expect(within(rows[2]).getByRole('cell')).toHaveTextContent('24');
  });
  it('renders nothing without rows', () => {
    const { container } = render(<Specifications specs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Description', () => {
  it('description is text not html', () => {
    const { container } = render(<Description description={'<script>alert(1)</script>\n\n<b>bold</b>'} />);
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });
  it('splits paragraphs on blank lines', () => {
    expect(paragraphsOf('One\ntwo\n\nThree\n\n\n')).toEqual(['One two', 'Three']);
    expect(paragraphsOf(null)).toEqual([]);
  });
  it('disclaimer renders under the description', () => {
    render(<Description description="Reseller text." />);
    const section = screen.getByRole('region', { name: 'Description' });
    const texts = [...section.querySelectorAll('p')].map((p) => p.textContent);
    expect(texts[0]).toBe('Reseller text.');
    expect(texts[1]).toMatch(/^Fitment is checked against/);
  });
  it('disclaimer renders without tailoring', () => {
    render(<Description description={null} />);
    expect(screen.getByText(/Fitment is checked against/)).toBeInTheDocument();
  });
});

describe('SellerLine', () => {
  it('seller line uses the reseller name and days', () => {
    render(<SellerLine reseller="Küstenwerk" days={30} />);
    expect(screen.getByText('Sold and fulfilled by Küstenwerk. 30-day returns at any counter.')).toBeInTheDocument();
  });
});

describe('RelatedItems', () => {
  it('related hidden when none', () => {
    const { container } = render(<RelatedItems products={[]} store="s" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('related add posts the related sku', async () => {
    installFakeApi(stateOf(GOLF_2016));
    const base = globalThis.fetch;
    const posts: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (input === '/api/cart/lines') {
          posts.push(JSON.parse(String(init?.body)));
          return new Response(JSON.stringify({ cartId: 'c', count: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return base(input, init);
      }),
    );
    const user = userEvent.setup();
    render(<RelatedItems products={[summary()]} store="s" />);
    expect(screen.getByRole('heading', { name: 'Often bought together' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vektra brake disc' })).toHaveAttribute('href', '/en-US/s/p/vektra-brake-disc');
    await user.click(screen.getByRole('button', { name: 'Add Vektra brake disc to cart' }));
    await waitFor(() => expect(posts).toEqual([{ sku: 'MLV-BD-42001', quantity: 1 }]));
  });

  it('no axe violations', async () => {
    installFakeApi(stateOf(GOLF_2016));
    const { container } = render(<RelatedItems products={[summary(), summary({ id: 'r2', name: 'Other' })]} store="s" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
