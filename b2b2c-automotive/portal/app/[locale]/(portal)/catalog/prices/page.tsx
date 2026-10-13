import { PricesTable } from '@/components/pricing/PricesTable';
import { titleOf } from '@/lib/portal/page-title';

// Tab "Price overrides" (workstream T).
export default function PricesPage() {
  return <PricesTable />;
}

export const generateMetadata = titleOf(['catalog.tabs', 'prices'], ['nav.items', 'catalog']);
