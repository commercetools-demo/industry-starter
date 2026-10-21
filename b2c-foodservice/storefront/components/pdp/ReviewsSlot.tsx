import { REVIEWS_ENABLED } from '@/lib/shop-config';

/**
 * Where workstream M mounts its reviews section (list, sorting, the write form). Until M ships `REVIEWS_ENABLED` is false
 * and the slot renders nothing: no placeholder text, no fake content (Q-H-14). M replaces the body of this component with
 * `<ReviewsSection productId={...} />` and flips the flag in `lib/shop-config.ts`.
 */
export default function ReviewsSlot({ productId }: { productId: string }) {
  if (!REVIEWS_ENABLED) return null;
  return <div id="reviews-list" data-product-id={productId} />;
}
