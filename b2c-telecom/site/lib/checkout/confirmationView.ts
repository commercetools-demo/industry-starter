import type { OrderConfirmationView } from '@/lib/types';

export type BannerState = 'Open' | 'Confirmed' | 'Complete' | 'Cancelled';
export type PaymentKey = 'Paid' | 'Pending' | 'BalanceDue' | 'Failed';

const BANNER_STATES: readonly BannerState[] = ['Open', 'Confirmed', 'Complete', 'Cancelled'];
const PAYMENT_KEYS: readonly PaymentKey[] = ['Paid', 'Pending', 'BalanceDue', 'Failed'];

/** The banner follows the order's TRUE state; a state this page does not know reads as just placed. */
export function bannerState(orderState: string): BannerState {
  return BANNER_STATES.find((state) => state === orderState) ?? 'Open';
}

/** `CreditOwed` and an absent state are not shown. */
export function paymentKey(paymentState: string | null): PaymentKey | null {
  return PAYMENT_KEYS.find((key) => key === paymentState) ?? null;
}

/** The order can still be cancelled online: strictly before 00:00 UTC of the service-start date (D-040, D-062). U's own comparison; V owns the action. */
export function cancelWindowOpen(serviceStartDate: string, now: Date): boolean {
  const start = Date.parse(`${serviceStartDate}T00:00:00Z`);
  return Number.isFinite(start) && now.getTime() < start;
}

export interface ConfirmationFacts {
  banner: BannerState;
  payment: PaymentKey | null;
  /** Address, email and payment state belong to the buyer; others get the reference, state, lines and totals only. */
  showPrivate: boolean;
  showCancelSentence: boolean;
  showAccountLinks: boolean;
  showGuestKeep: boolean;
}

/** Everything the page decides before it renders: which sections the viewer may see and which sentences apply. */
export function confirmationFacts(view: OrderConfirmationView, now: Date): ConfirmationFacts {
  const banner = bannerState(view.order.orderState);
  return {
    banner,
    payment: view.full ? paymentKey(view.paymentState) : null,
    showPrivate: view.full,
    showCancelSentence: view.owner && banner !== 'Cancelled' && cancelWindowOpen(view.order.serviceStartDate, now),
    showAccountLinks: view.owner,
    showGuestKeep: view.full && view.isGuest,
  };
}
