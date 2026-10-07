import type { Order, OrderConfirmationView } from '@/lib/types';
import { bannerState, cancelWindowOpen, confirmationFacts, paymentKey } from './confirmationView';

const view = (patch: Partial<OrderConfirmationView> = {}, order: Partial<Order> = {}): OrderConfirmationView => ({
  order: { orderState: 'Open', serviceStartDate: '2026-10-12', ...order } as Order,
  full: true,
  owner: true,
  email: 'a@b.co',
  isGuest: false,
  paymentState: 'Paid',
  ...patch,
});

describe('confirmationView', () => {
  it('the banner follows the true state; unknown reads as placed', () => {
    expect(bannerState('Confirmed')).toBe('Confirmed');
    expect(bannerState('Cancelled')).toBe('Cancelled');
    expect(bannerState('Weird')).toBe('Open');
  });
  it('payment state: the four shown, CreditOwed and absent hidden', () => {
    expect(paymentKey('Paid')).toBe('Paid');
    expect(paymentKey('BalanceDue')).toBe('BalanceDue');
    expect(paymentKey('CreditOwed')).toBeNull();
    expect(paymentKey(null)).toBeNull();
  });
  it('the cancel window is open strictly before 00:00 UTC of the service start', () => {
    expect(cancelWindowOpen('2026-10-12', new Date('2026-10-11T23:59:59Z'))).toBe(true);
    expect(cancelWindowOpen('2026-10-12', new Date('2026-10-12T00:00:00Z'))).toBe(false);
    expect(cancelWindowOpen('nope', new Date())).toBe(false);
  });
  it('full view of the owner: private sections, cancel sentence while the window is open, account links', () => {
    const facts = confirmationFacts(view(), new Date('2026-10-07T10:00:00Z'));
    expect(facts).toMatchObject({ showPrivate: true, showCancelSentence: true, showAccountLinks: true, showGuestKeep: false, payment: 'Paid' });
  });
  it('a guest who placed the order sees the guest sentence and no account links or cancel sentence', () => {
    const facts = confirmationFacts(view({ owner: false, isGuest: true }), new Date('2026-10-07T10:00:00Z'));
    expect(facts).toMatchObject({ showPrivate: true, showCancelSentence: false, showAccountLinks: false, showGuestKeep: true });
  });
  it('limited view: nothing private, no payment, no account links', () => {
    const facts = confirmationFacts(view({ full: false, owner: false }), new Date('2026-10-07T10:00:00Z'));
    expect(facts).toMatchObject({ showPrivate: false, payment: null, showAccountLinks: false, showCancelSentence: false });
  });
  it('a cancelled order has no cancel sentence', () => {
    expect(confirmationFacts(view({}, { orderState: 'Cancelled' }), new Date('2026-10-07T10:00:00Z')).showCancelSentence).toBe(false);
  });
});
