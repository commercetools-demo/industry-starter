import { AssortmentTable } from '@/components/catalog/AssortmentTable';
import { titleOf } from '@/lib/portal/page-title';

// Tab "Assigned products" (workstream T).
export default function CatalogPage() {
  return <AssortmentTable />;
}

export const generateMetadata = titleOf(['catalog.tabs', 'assigned'], ['nav.items', 'catalog']);
