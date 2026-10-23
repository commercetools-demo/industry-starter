import { useTranslations } from 'next-intl';
import FacetGroup from '@/components/listing/FacetGroup';
import type { FacetGroup as FacetGroupModel } from '@/lib/types';

/** Sticky desktop sidebar (244px, top 88px under the 72px header). Hidden under 900px, where the Filters sheet takes over. */
export default function FilterSidebar({ groups, unavailable = false }: { groups: FacetGroupModel[]; unavailable?: boolean }) {
  const t = useTranslations('plp.filters');
  return (
    <aside aria-label={t('title')} className="sticky top-[88px] self-start max-stack:hidden">
      {unavailable ? <p className="m-0 text-[13px] text-ink-3">{t('unavailable')}</p> : null}
      {groups.map((g) => (
        <FacetGroup key={g.name} group={g} />
      ))}
    </aside>
  );
}
