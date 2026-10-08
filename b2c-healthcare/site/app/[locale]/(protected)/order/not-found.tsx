import { NotFoundView } from '@/components/layout/NotFoundView';

// An unknown order id and another customer's order id render this one card with HTTP 404: nothing tells them apart.
export default function OrderNotFound() {
  return <NotFoundView kind="order" />;
}
