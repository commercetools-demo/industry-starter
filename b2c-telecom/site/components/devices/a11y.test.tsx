// Axe-style assertions for the device components (no axe library in the project): names, roles, states and live regions.
import { fireEvent, screen, within } from '@testing-library/react';
import { BundleView } from '@/components/bundle/BundleView';
import { NOVA_5G, NOVA_PRO, NOVA_PRO_256, deviceLine, usd } from '@/lib/devices/__fixtures__/devices';
import { makeCart } from '@/test/fixtures/cart';
import { renderWithProviders } from '@/test/utils';
import { DeviceCard } from './DeviceCard';
import { FinancingDecisionNotice } from './FinancingDecisionNotice';

const accessibleName = (element: HTMLElement): string => {
  const labelled = element.getAttribute('aria-label');
  if (labelled) return labelled;
  return (element.closest('label')?.textContent ?? element.textContent ?? '').trim();
};

describe('device components accessibility', () => {
  it('every radio, button and group on a device card has an accessible name and the groups say what they choose', () => {
    renderWithProviders(<DeviceCard offer={NOVA_PRO} today="2026-10-07" onAdd={async () => undefined} />);
    for (const radio of screen.getAllByRole('radio')) expect(accessibleName(radio), radio.outerHTML).not.toBe('');
    for (const button of screen.getAllByRole('button')) expect(accessibleName(button)).not.toBe('');
    expect(screen.getAllByRole('radiogroup').map((group) => group.getAttribute('aria-label'))).toEqual(['Color', 'Memory', 'How do you want to pay?', 'Installment term']);
    expect(screen.getByRole('group', { name: 'Quantity' })).toBeInTheDocument();
  });

  it('a disabled mode is announced as disabled and its reason is text, not only a colour', () => {
    renderWithProviders(<DeviceCard offer={NOVA_5G} today="2026-10-07" onAdd={async () => undefined} />);
    const lease = screen.getByRole('radio', { name: /Lease/ });
    expect(lease).toBeDisabled();
    expect(within(lease.closest('label') as HTMLElement).getByText('Not available for Nova 5G')).toBeInTheDocument();
  });

  it('a disabled term points at the note that explains it', () => {
    renderWithProviders(<DeviceCard offer={NOVA_5G} today="2026-10-07" onAdd={async () => undefined} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Silver' }));
    fireEvent.click(screen.getByRole('radio', { name: '256 GB' }));
    const group = screen.getByRole('radiogroup', { name: 'Installment term' });
    const note = document.getElementById(group.getAttribute('aria-describedby') ?? '');
    expect(note).toHaveTextContent('The 36-month term is not available for this color and memory.');
  });

  it('the summary is a polite live region so a changed price is announced', () => {
    renderWithProviders(<DeviceCard offer={NOVA_PRO} today="2026-10-07" onAdd={async () => undefined} />);
    expect(screen.getByText('Due today').closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
  });

  it('a refusal is an alert', async () => {
    renderWithProviders(
      <DeviceCard
        offer={NOVA_PRO}
        today="2026-10-07"
        onAdd={async () => {
          throw new Error('boom');
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add to bundle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/./);
  });

  it('the bundle line: the change button states whether the picker is open and the remove button names the device', () => {
    const line = deviceLine('D1', { mode: 'installments', termMonths: 24, endOfTerm: 'owned-after-final-payment' }, usd(4200), 1, { device: { color: 'black', memoryGb: 256, prices: NOVA_PRO_256 } });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ cart: null, prompts: [] }), { status: 200 }))));
    renderWithProviders(<BundleView initialCart={makeCart({ lines: [line] })} signedIn links={[]} />);
    const change = screen.getByRole('button', { name: 'Change how you pay' });
    expect(change).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(change);
    expect(change).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Remove Nova Pro' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('the declined financing notice is an alert named by its heading', () => {
    renderWithProviders(
      <FinancingDecisionNotice
        decision={{ decisionId: 's', outcome: 'declined', reason: 'customer-declined', financedTotal: usd(1), limit: usd(2), decidedAt: '2026-10-07T00:00:00.000Z' }}
        lines={[{ id: 'D1', name: 'Nova Pro' }]}
      />,
    );
    expect(screen.getByRole('alert', { name: 'We could not approve financing for this bundle.' })).toBeInTheDocument();
  });
});
