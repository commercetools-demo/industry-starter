import ReviewsSection, { type ReviewsSectionProps } from '@/components/reviews/ReviewsSection';
import { REVIEWS_ENABLED } from '@/lib/shop-config';

/**
 * Where workstream M mounts its reviews section (list, sorting, the write form), below H's `RatingSummary`.
 * With `REVIEWS_ENABLED` false the slot renders nothing: no placeholder text, no fake content (Q-H-14).
 */
export default function ReviewsSlot(props: ReviewsSectionProps) {
  if (!REVIEWS_ENABLED) return null;
  return <ReviewsSection {...props} />;
}
