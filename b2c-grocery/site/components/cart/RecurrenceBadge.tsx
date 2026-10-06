import type { CartLine } from '@/lib/types';

/** Extension point for workstream W (subscription badge on a line). Renders nothing in J. */
export function RecurrenceBadge(props: { line: CartLine }) {
  void props;
  return null;
}
