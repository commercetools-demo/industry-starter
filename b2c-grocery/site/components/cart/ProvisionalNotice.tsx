import type { Cart } from '@/lib/types';

/** Extension point for workstream N (provisional total notice for approximate-weight lines). Renders nothing in J. */
export function ProvisionalNotice(props: { cart: Cart }) {
  void props;
  return null;
}
