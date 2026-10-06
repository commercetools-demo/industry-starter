import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { cartLine, makeCart, renderWithCart } from '@/test/cart';
import { makeProduct, makeVariant } from '@/test/product';
import { renderWithProviders } from '@/test/utils';
import { AddToBag } from './AddToBag';
import { RecurrenceSelector } from './RecurrenceSelector';

vi.mock('@/hooks/useSaved', () => ({ useSaved: () => ({ isSaved: () => false, toggle: async () => {} }) }));

const policies = [
  { key: 'weekly', name: 'Every week' },
  { key: 'every-2-weeks', name: 'Every 2 weeks' },
  { key: 'monthly', name: 'Every month' },
];
const NOTICE = 'The price of each repeat order follows the current price and may change.';
const milk = makeProduct({ id: 'p-milk', name: 'Whole milk', recurringEligible: true });
const variant = makeVariant({ sku: 'MILK-1L' });

function Controlled({ product = milk, list = policies }: { product?: typeof milk; list?: typeof policies }) {
  const [value, setValue] = useState('');
  return <RecurrenceSelector product={product} variant={variant} policies={list} value={value} onChange={setValue} />;
}

describe('RecurrenceSelector', () => {
  it('Ineligible product: no selector is shown', () => {
    renderWithProviders(<Controlled product={makeProduct({ recurringEligible: false })} />);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('Flag off (the page passes no policies): nothing is rendered', () => {
    renderWithProviders(<Controlled list={[]} />);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByText('Repeat')).not.toBeInTheDocument();
  });

  it('Eligible: One-time (default) plus the three policies, no notice yet', () => {
    renderWithProviders(<Controlled />);
    const group = screen.getByRole('radiogroup', { name: 'Repeat' });
    expect(within(group).getAllByRole('radio').map((r) => r.parentElement?.textContent)).toEqual(['One-time', 'Every week', 'Every 2 weeks', 'Every month']);
    expect(within(group).getByLabelText('One-time')).toBeChecked();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });

  it('Notice shown: choosing a cadence shows the price notice, going back to one-time hides it', async () => {
    renderWithProviders(<Controlled />);
    await userEvent.click(screen.getByLabelText('Every 2 weeks'));
    expect(screen.getByText(NOTICE)).toBeVisible();
    await userEvent.click(screen.getByLabelText('One-time'));
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
  });
});

describe('AddToBag with a cadence', () => {
  const bodies = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST').map((c) => JSON.parse(String((c[1] as RequestInit).body)));

  const stub = () => {
    const after = makeCart({ lines: [cartLine({ sku: 'MILK-1L' })] });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify({ cart: init?.method === 'POST' ? after : null }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };
  afterEach(() => vi.unstubAllGlobals());

  it('Subscribe: the selected cadence is sent with the add request', async () => {
    const fetchMock = stub();
    renderWithCart(<AddToBag product={milk} variant={variant} recurrencePolicies={policies} />);
    await userEvent.click(screen.getByLabelText('Every 2 weeks'));
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(await screen.findAllByText('Added to your bag')).toHaveLength(1);
    expect(bodies(fetchMock)).toEqual([{ sku: 'MILK-1L', quantity: 1, recurrencePolicyKey: 'every-2-weeks' }]);
  });

  it('One-time (default): the request has no recurrence key', async () => {
    const fetchMock = stub();
    renderWithCart(<AddToBag product={milk} variant={variant} recurrencePolicies={policies} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(await screen.findAllByText('Added to your bag')).toHaveLength(1);
    expect(bodies(fetchMock)).toEqual([{ sku: 'MILK-1L', quantity: 1 }]);
  });

  it('without policies there is no selector in the buy box', () => {
    renderWithCart(<AddToBag product={milk} variant={variant} />);
    expect(screen.queryByRole('radiogroup', { name: 'Repeat' })).not.toBeInTheDocument();
  });
});
