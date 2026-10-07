import type { ReactElement } from 'react';
import type { Order } from '@/lib/types';

/** Extension slot of the order detail: V fills it with "Cancel order" and "Return a device". Renders nothing in S. */
export function OrderActions(props: { order: Order }): ReactElement | null {
  void props;
  return null;
}
