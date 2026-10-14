import { PriorityLists } from '@/components/discounts/PriorityLists';
import { titleOf } from '@/lib/portal/page-title';

// Tab "Discount priority" (workstream T).
export default function PriorityPage() {
  return <PriorityLists />;
}

export const generateMetadata = titleOf(['catalog.tabs', 'priority'], ['nav.items', 'catalog']);
