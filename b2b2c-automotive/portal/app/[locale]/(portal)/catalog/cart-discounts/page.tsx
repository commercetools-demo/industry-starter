import { DiscountList } from '@/components/discounts/DiscountList';
import { titleOf } from '@/lib/portal/page-title';

// Tab "Cart discounts" (workstream T).
export default function CartDiscountsPage() {
  return <DiscountList kind="cart" />;
}

export const generateMetadata = titleOf(['catalog.tabs', 'cartDiscounts'], ['nav.items', 'catalog']);
