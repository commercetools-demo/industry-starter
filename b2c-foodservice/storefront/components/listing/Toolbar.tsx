import AvailabilityChip from '@/components/listing/AvailabilityChip';
import FilterSheet from '@/components/listing/FilterSheet';
import SortSelect, { type SortOption } from '@/components/listing/SortSelect';
import type { ListingParams, ListingScope } from '@/lib/search/params';
import type { FacetGroup } from '@/lib/types';

/** Filters button (under 900px), the store availability chip (US only) and the sort select. */
export default function Toolbar({
  groups, params, scope, basePath, apiScope, total, activeCount, sortOptions, availHref,
}: {
  groups: FacetGroup[];
  params: ListingParams;
  scope: ListingScope;
  basePath: string;
  apiScope: string;
  total: number;
  activeCount: number;
  sortOptions: SortOption[];
  availHref: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <FilterSheet groups={groups} params={params} scope={scope} basePath={basePath} apiScope={apiScope} total={total} activeCount={activeCount} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <AvailabilityChip active={params.avail} href={availHref} />
        <SortSelect value={params.sort} options={sortOptions} />
      </div>
    </div>
  );
}
