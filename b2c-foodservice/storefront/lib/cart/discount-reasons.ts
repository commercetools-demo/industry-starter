import type { CodeState } from '@/lib/types';

/** The reasons commercetools gives when `addDiscountCode` is refused (DiscountCodeNonApplicable.reason). */
export const CODE_REJECTION_REASONS = [
  'DoesNotExist', 'NotActive', 'NotValid', 'DoesNotMatchCart', 'MaxApplicationReached', 'ApplicationStoppedByPreviousDiscount',
] as const;
export type CodeRejectionReason = (typeof CODE_REJECTION_REASONS)[number];

export function isCodeRejectionReason(v: unknown): v is CodeRejectionReason {
  return typeof v === 'string' && (CODE_REJECTION_REASONS as readonly string[]).includes(v);
}

/** i18n key (under `cart`) of the muted reason on an applied code chip; null while the code applies. */
export function stateReasonKey(state: CodeState): `code.reason.${Exclude<CodeState, 'MatchesCart'>}` | null {
  return state === 'MatchesCart' ? null : `code.reason.${state}`;
}

/** i18n key (under `cart`) of the inline message for a refused code. Unknown reasons read as the generic message. */
export function rejectionKey(reason: unknown): `code.error.${CodeRejectionReason}` | 'code.error.generic' {
  return isCodeRejectionReason(reason) ? `code.error.${reason}` : 'code.error.generic';
}

const STATES: readonly CodeState[] = [
  'MatchesCart', 'NotActive', 'DoesNotMatchCart', 'MaxApplicationReached', 'ApplicationStoppedByPreviousDiscount', 'NotValid',
];

/** commercetools code state to ours; anything unknown reads as NotValid (muted, with a remove button). */
export function toCodeState(state: string | undefined): CodeState {
  return STATES.find((s) => s === state) ?? 'NotValid';
}
