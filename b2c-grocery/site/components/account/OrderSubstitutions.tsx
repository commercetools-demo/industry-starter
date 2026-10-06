import type { Order } from '@/lib/types';

/** Extension point for workstream U (pending substitution proposals on an order). Renders nothing in R. */
export function OrderSubstitutions(props: { order: Order }) {
  void props;
  return null;
}
