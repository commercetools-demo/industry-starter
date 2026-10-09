import { describe, expect, it } from 'vitest';
import { BookingConfirmation } from '@/components/booking/BookingConfirmation';
import { Input } from '@/components/ui/Inputs';
import { renderWithProviders, screen } from '@/test/utils';

// Z sweep (axe color-contrast): small text on white / brand-50 must reach 4.5:1.
describe('accessibility: text contrast of small text', () => {
  it('the "(optional)" hint is neutral-600 (neutral-500 is 4.3:1 on white)', () => {
    renderWithProviders(<Input label="Phone" optional />);
    expect(screen.getByText('(optional)')).toHaveClass('text-neutral-600');
  });

  it('the guest nudge link on brand-50 is brand-800 (brand-700 is 4.4:1)', () => {
    renderWithProviders(
      <BookingConfirmation signedIn={false} booking={{ reference: 'BK-1', firstName: 'G', doctorName: 'Dr. A', specialty: 'GP', clinicName: 'C', mode: 'remote', startsAt: '2026-10-09T13:00:00Z', timezone: 'America/New_York', fee: null, guest: true }} />,
    );
    const nudge = screen.getByTestId('guest-nudge');
    expect(nudge.querySelector('a')).toHaveClass('text-brand-800');
  });
});
