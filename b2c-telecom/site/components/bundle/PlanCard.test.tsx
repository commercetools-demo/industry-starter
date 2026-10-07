import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addonLine, phoneLine, planLine } from '@/test/fixtures/cart';
import { renderWithProviders } from '@/test/utils';
import { PlanCard } from './PlanCard';

describe('PlanCard', () => {
  it('Label in the bundle: monthly price, price-lock note, one-time fees, early-termination fee, speeds, data and a unique plan ID', () => {
    renderWithProviders(<PlanCard line={planLine()} dependents={[]} onQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Cable 500' })).toBeInTheDocument();
    expect(screen.getAllByText('Cable internet')).toHaveLength(2); // the card's kind tag and the label's own line
    expect(screen.getByText('$59.99/mo')).toBeInTheDocument();
    const label = screen.getByRole('article', { name: 'Broadband Facts: Cable 500' });
    for (const text of ['$59.99', 'Price locked for 24 months.', '$25.00', '$10 x months remaining', '525 Mbps', 'Unlimited', 'Unique plan ID: MLV-CBL-500-24M']) {
      expect(label).toHaveTextContent(text);
    }
  });

  it('shows up to three highlights, the term and the month-by-month schedule', () => {
    renderWithProviders(<PlanCard line={planLine()} dependents={[]} onQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getAllByText(/Up to 500 Mbps|Free modem/).length).toBeGreaterThan(0);
    expect(screen.getByText('24-month term')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your price, month by month' })).toBeInTheDocument();
  });

  it('a non-phone plan has no line stepper', () => {
    renderWithProviders(<PlanCard line={planLine()} dependents={[]} onQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Number of lines' })).not.toBeInTheDocument();
  });

  it('the phone stepper is limited to 1-5 lines and reports the new number', async () => {
    const onQuantity = vi.fn();
    const first = renderWithProviders(<PlanCard line={phoneLine({ quantity: 1 })} dependents={[]} onQuantity={onQuantity} onRemove={vi.fn()} />);
    const group = screen.getByRole('group', { name: 'Number of lines' });
    expect(within(group).getByRole('button', { name: 'Fewer lines' })).toBeDisabled();
    await userEvent.click(within(group).getByRole('button', { name: 'More lines' }));
    expect(onQuantity).toHaveBeenCalledWith('P1', 2);
    first.unmount();
    renderWithProviders(<PlanCard line={phoneLine({ quantity: 5 })} dependents={[]} onQuantity={onQuantity} onRemove={vi.fn()} />);
    expect(within(screen.getByRole('group', { name: 'Number of lines' })).getByRole('button', { name: 'More lines' })).toBeDisabled();
  });

  it('Remove plan without dependents removes at once', async () => {
    const onRemove = vi.fn();
    renderWithProviders(<PlanCard line={planLine()} dependents={[]} onQuantity={vi.fn()} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove plan' }));
    expect(onRemove).toHaveBeenCalledWith('L1', false);
  });

  it('Remove plan with dependents opens the dialog listing them; Keep closes it, Remove all cascades', async () => {
    const onRemove = vi.fn();
    renderWithProviders(<PlanCard line={planLine()} dependents={[addonLine()]} onQuantity={vi.fn()} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove Cable 500?' });
    expect(dialog).toHaveTextContent('These items go with it: Apple TV+.');
    expect(onRemove).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep' }));
    expect(onRemove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Remove plan' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove all' }));
    expect(onRemove).toHaveBeenCalledWith('L1', true);
  });

  it('de-DE: German copy around the English label', () => {
    renderWithProviders(<PlanCard line={planLine()} dependents={[]} onQuantity={vi.fn()} onRemove={vi.fn()} />, { locale: 'de-DE' });
    expect(screen.getByRole('button', { name: 'Tarif entfernen' })).toBeInTheDocument();
    expect(screen.getByText('Kabel-Internet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Broadband Facts' })).toBeInTheDocument();
  });
});
