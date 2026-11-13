import OrderNotFound from '@/components/account/orders/OrderNotFound';

/** The 404 of `orders/[orderNumber]`: identical for an unknown and for someone else's order. */
export default function AccountOrderNotFound() {
  return <OrderNotFound />;
}
