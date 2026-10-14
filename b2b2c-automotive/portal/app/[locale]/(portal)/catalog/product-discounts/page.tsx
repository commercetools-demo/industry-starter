import { DiscountList } from '@/components/discounts/DiscountList';
import { titleOf } from '@/lib/portal/page-title';

// Tab "Product discounts" (workstream T).
export default function ProductDiscountsPage() {
  return <DiscountList kind="product" />;
}

export const generateMetadata = titleOf(['catalog.tabs', 'productDiscounts'], ['nav.items', 'catalog']);
