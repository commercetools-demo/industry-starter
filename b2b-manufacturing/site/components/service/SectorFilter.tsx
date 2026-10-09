import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { Service } from '@/lib/types';
import { SECTOR_KEYS, type ServiceCategory } from './constants';

/** True when at least two sectors would show different services (otherwise the control adds nothing). */
export function sectorFilterUseful(services: Service[]): boolean {
  const signatures = new Set(SECTOR_KEYS.map((k) => services.filter((s) => s.sectors.includes(k)).map((s) => s.id).join('|')));
  return signatures.size >= 2;
}

/** Chip row of plain links (`?sector=` is rewritten to a static segment). The active chip is marked and a clear link removes the filter. */
export function SectorFilter({ category, active, services }: { category: ServiceCategory; active?: string; services: Service[] }) {
  const t = useTranslations('listing');
  if (!active && !sectorFilterUseful(services)) return null;
  const label = (k: string) => (t.has(`sectors.${k}`) ? t(`sectors.${k}`) : k);
  const base = `/${category}`;
  return (
    <div className="sector-filter" data-testid="sector-filter">
      <nav aria-label={t('sectorNav')}>
        <ul className="chips">
          <li><Link className="chip" href={base} aria-current={active ? undefined : 'true'}>{t('sectorAll')}</Link></li>
          {SECTOR_KEYS.map((k) => (
            <li key={k}><Link className="chip" href={{ pathname: base, query: { sector: k } }} aria-current={active === k ? 'true' : undefined}>{label(k)}</Link></li>
          ))}
        </ul>
      </nav>
      {active ? (
        <p className="sector-active" data-testid="sector-active">
          {t('sectorActive', { sector: label(active) })} <Link href={base}>{t('clearFilter')}</Link>
        </p>
      ) : null}
    </div>
  );
}
