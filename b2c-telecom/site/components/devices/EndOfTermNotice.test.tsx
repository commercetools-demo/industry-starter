import { screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { renderWithProviders } from '@/test/utils';
import { EndOfTermNotice } from './EndOfTermNotice';

/** Renders one notice and removes it again, so the next one starts from an empty document. */
function show(props: ComponentProps<typeof EndOfTermNotice>, locale: 'en-US' | 'de-DE' = 'en-US'): string {
  const view = renderWithProviders(<EndOfTermNotice {...props} />, { locale });
  const text = screen.getByText(/./).textContent ?? '';
  view.unmount();
  return text;
}

describe('EndOfTermNotice', () => {
  it('End of term obligation disclosed: lease states the return-by date, installments the ownership date, outright ownership from day one', () => {
    expect(show({ endOfTerm: 'return', endDate: '2028-10-07' })).toBe('At the end of the lease you must return the device by October 7, 2028 (within 30 days of your final payment).');
    expect(show({ endOfTerm: 'owned-after-final-payment', endDate: '2028-09-07' })).toBe('You own the device after your final payment on September 7, 2028.');
    expect(show({ endOfTerm: 'owned' })).toBe('You own the device from day one.');
  });

  it('adds the estimate label only while the date is computed from today', () => {
    expect(show({ endOfTerm: 'return', endDate: '2028-10-07', estimate: true })).toMatch(/ Estimated, if you order today\.$/);
    expect(show({ endOfTerm: 'return', endDate: '2028-10-07' })).not.toMatch(/Estimated/);
    expect(show({ endOfTerm: 'owned', estimate: true })).not.toMatch(/Estimated/);
  });

  it('formats the date in the buyer language', () => {
    expect(show({ endOfTerm: 'return', endDate: '2028-10-07' }, 'de-DE')).toBe(
      'Am Ende der Mietzeit müssen Sie das Gerät bis zum 7. Oktober 2028 zurückgeben (innerhalb von 30 Tagen nach der letzten Rate).',
    );
  });

  it('reads an ISO date-time as its day', () => {
    expect(show({ endOfTerm: 'owned-after-final-payment', endDate: '2028-09-07T00:00:00.000Z' })).toContain('September 7, 2028');
  });
});
