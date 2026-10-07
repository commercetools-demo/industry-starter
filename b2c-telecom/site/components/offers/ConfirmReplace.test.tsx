import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { ConfirmReplace } from './ConfirmReplace';

describe('ConfirmReplace', () => {
  it('names the held plan and the new one, and how many add-ons go', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <ConfirmReplace pending={{ kind: 'replace', heldName: 'Cable 500', replaceLineId: 'l1', dependentCount: 2, sku: 's', quantity: 1 }} offerName="Cable Gig" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    expect(screen.getByText('Replace Cable 500 with Cable Gig?')).toBeInTheDocument();
    expect(screen.getByText('Switching removes 2 add-ons.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Replace', hidden: true }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('no dependents: no add-on sentence', () => {
    renderWithProviders(
      <ConfirmReplace pending={{ kind: 'replace', heldName: 'Essential', replaceLineId: 'l1', dependentCount: 0, sku: 's', quantity: 1 }} offerName="Plus" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByText(/Switching removes/)).toBeNull();
  });

  it('asks before removing a plan with add-ons', () => {
    renderWithProviders(<ConfirmReplace pending={{ kind: 'remove', dependentCount: 1 }} offerName="Cable 500" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Remove Cable 500 and its 1 add-on?')).toBeInTheDocument();
  });

  it('is translated', () => {
    renderWithProviders(<ConfirmReplace pending={{ kind: 'remove', dependentCount: 2 }} offerName="Kabel 500" onConfirm={vi.fn()} onCancel={vi.fn()} />, { locale: 'de-DE' });
    expect(screen.getByText('Kabel 500 und 2 Zusatzoptionen entfernen?')).toBeInTheDocument();
  });
});
