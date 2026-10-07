import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BundleIssue } from '@/lib/types';
import { planLine } from '@/test/fixtures/cart';
import { renderWithProviders } from '@/test/utils';
import { IssuesBanner } from './IssuesBanner';

const issue = (patch: Partial<BundleIssue> = {}): BundleIssue => ({
  code: 'NOT_SERVICEABLE',
  severity: 'blocking',
  lineId: 'L1',
  offerKey: 'malva-offer-cable-500',
  resolution: 'remove',
  reasons: [{ code: 'NOT_SERVICEABLE', messageKey: 'offers.reason.NOT_SERVICEABLE', params: { offerName: 'Cable 500', postalCode: '59001' }, offerKeys: ['malva-offer-cable-500'] }],
  ...patch,
});

describe('IssuesBanner', () => {
  it('is an alert that names the line and the reason, with a Remove action', async () => {
    const onRemove = vi.fn();
    renderWithProviders(<IssuesBanner issues={[issue()]} lines={[planLine()]} onRemove={onRemove} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Please review your bundle');
    expect(alert).toHaveTextContent("Cable 500 isn't available at 59001.");
    await userEvent.click(screen.getByRole('button', { name: 'Remove Cable 500' }));
    expect(onRemove).toHaveBeenCalledWith('L1');
  });

  it('a missing-equipment issue links to the add-ons page for that plan instead of removing', () => {
    renderWithProviders(
      <IssuesBanner
        issues={[issue({ resolution: 'choose-equipment', reasons: [{ code: 'REQUIRED_EQUIPMENT_MISSING', messageKey: 'offers.reason.REQUIRED_EQUIPMENT_MISSING', params: { planName: 'Cable 500', kind: 'router' }, offerKeys: [] }] })]}
        lines={[planLine()]}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole('link', { name: 'Change' })).toHaveAttribute('href', '/en-US/shop/add-ons?for=L1');
  });

  it('an unknown message key falls back to the generic sentence', () => {
    renderWithProviders(<IssuesBanner issues={[issue({ reasons: [{ code: 'X', messageKey: 'nope.nothing', params: {}, offerKeys: [] }] })]} lines={[planLine()]} onRemove={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('This item cannot be added to your bundle right now.');
  });

  it('renders nothing without issues', () => {
    renderWithProviders(<IssuesBanner issues={[]} lines={[]} onRemove={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
