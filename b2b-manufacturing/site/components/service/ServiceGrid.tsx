import { useTranslations } from 'next-intl';
import type { Service } from '@/lib/types';
import { ServiceTile } from './ServiceTile';

/** Cards in the order given, numbered 01.. continuously (so an unpublished service leaves no gap). Each card links to `/<category>/<slug>`. The first row loads its photos eagerly: it is what the visitor sees first (LCP). */
export function ServiceGrid({ services }: { services: Service[] }) {
  const t = useTranslations('listing');
  return (
    <div className="grid g3" data-testid="service-grid">
      {services.map((s, i) => (
        <ServiceTile key={s.id} id={s.id} href={`/${s.category}/${s.slug}`} index={i + 1} name={s.name} summary={s.summary} imageUrl={s.imageUrl} more={t('more')} eager={i < 3} />
      ))}
    </div>
  );
}
