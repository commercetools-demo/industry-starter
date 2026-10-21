import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';

export interface FilterChip { key: string; label: string; href: string }

/**
 * One removable chip per selected value (and for the availability toggle) plus "Clear all". Every chip is a link, so
 * removal is a history entry and does not scroll to the top. Renders nothing when no filter is active.
 */
export default function ActiveFilters({ chips, clearAllHref }: { chips: FilterChip[]; clearAllHref: string }) {
  const t = useTranslations('plp');
  if (chips.length === 0) return null;
  return (
    <ul className="m-0 mb-5 flex list-none flex-wrap items-center gap-2 p-0" aria-label={t('filters.title')}>
      {chips.map((c) => (
        <li key={c.key}>
          <Link
            href={c.href}
            scroll={false}
            aria-label={t('chip.remove', { label: c.label })}
            className="inline-flex items-center gap-2 rounded-pill bg-ink px-3.5 py-2 text-[13px] font-medium text-surface no-underline hover:bg-ink/90"
          >
            {c.label}
            <Icon name="x" size={13} />
          </Link>
        </li>
      ))}
      <li>
        <Link href={clearAllHref} scroll={false} className="px-2 text-[13px] font-medium text-ink-2 underline underline-offset-2">
          {t('filters.clearAll')}
        </Link>
      </li>
    </ul>
  );
}
