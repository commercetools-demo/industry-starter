import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BlockedAdd } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { BlockedAddNotice } from './BlockedAddNotice';

const conflict: BlockedAdd = {
  kind: 'conflict',
  offerKey: 'malva-offer-wireless-5g',
  reasons: [{ code: 'EXCLUSIVE_CONFLICT', messageKey: 'offers.reason.EXCLUSIVE_CONFLICT', params: { candidateName: 'Air 5G', otherName: 'Cable 500' }, offerKeys: [] }],
  replace: { removeLineId: 'L1', removeOfferKey: 'malva-offer-cable-500', removeOfferName: 'Cable 500' },
};

describe('BlockedAddNotice', () => {
  it('a conflict shows the reason, Replace and Keep', async () => {
    const onReplace = vi.fn();
    const onDismiss = vi.fn();
    renderWithProviders(<BlockedAddNotice blocked={conflict} name="Air 5G" onReplace={onReplace} onDismiss={onDismiss} />);
    expect(screen.getByRole('alert')).toHaveTextContent("We could not add Air 5G");
    expect(screen.getByText("Air 5G can't be held together with Cable 500.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Replace Cable 500 with Air 5G' }));
    expect(onReplace).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Keep Cable 500' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('an incompatible add lists every reason and offers no override, only Close', () => {
    const blocked: BlockedAdd = {
      kind: 'incompatible',
      offerKey: 'o',
      reasons: [
        { code: 'SPEED_TOO_LOW', messageKey: 'offers.reason.SPEED_TOO_LOW', params: { max: 300, needed: 1000, planName: 'Cable Gig' }, offerKeys: [] },
        { code: 'TECHNOLOGY_MISMATCH', messageKey: 'offers.reason.TECHNOLOGY_MISMATCH', params: { planName: 'Cable Gig' }, offerKeys: [] },
      ],
    };
    renderWithProviders(<BlockedAddNotice blocked={blocked} name="Router" onDismiss={vi.fn()} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Replace/ })).not.toBeInTheDocument();
  });

  it('de-DE', () => {
    renderWithProviders(<BlockedAddNotice blocked={conflict} name="Air 5G" onReplace={vi.fn()} onDismiss={vi.fn()} />, { locale: 'de-DE' });
    expect(screen.getByRole('button', { name: 'Cable 500 durch Air 5G ersetzen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cable 500 behalten' })).toBeInTheDocument();
  });
});
