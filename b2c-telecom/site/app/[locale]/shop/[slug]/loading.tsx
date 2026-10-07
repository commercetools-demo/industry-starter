import type { ReactElement } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

/** Three card outlines while the category is read (the strip and chips are part of the page that follows). */
export default function ListingLoading(): ReactElement {
  return (
    <section aria-busy="true" className="mx-auto flex w-full max-w-(--container-width) flex-col gap-7 px-5 pb-16 pt-12 md:px-10">
      <Skeleton className="h-12 w-72 max-w-full" />
      <div className="grid gap-7 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18.75rem),1fr))]">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-96 rounded-xl" />
        ))}
      </div>
    </section>
  );
}
