'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import type { ListingParams } from '@/lib/listing-params';
import type { ListingFilterData } from '@/lib/listing-view';
import { FilterRail } from './FilterRail';

/** Below `desktop` the rail is hidden: a "Filters" button opens the same filters in a drawer that closes once a choice is applied. */
export function FiltersSheet({ data, params, className }: { data: ListingFilterData; params: ListingParams; className?: string }) {
  const t = useTranslations('plp.filters');
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <Button variant="secondary" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Icon icon={SlidersHorizontal} size={15} />
        {t('title')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('title')} placement="right">
        <FilterRail data={data} params={params} onChange={() => setOpen(false)} className="mt-(--space-4)" />
      </Dialog>
    </div>
  );
}
