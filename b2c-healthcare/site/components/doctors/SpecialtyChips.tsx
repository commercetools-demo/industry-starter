import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { SPECIALTIES } from '@/lib/specialties';
import { listingHref } from '@/lib/listing-url';
import type { ConsultationMode } from '@/lib/types';
import { cx } from '@/components/ui/cx';

export interface SpecialtyChipsProps {
  mode?: ConsultationMode;
  /** Currently selected specialty key (shown as current). */
  selected?: string;
  /** Visible heading; omit to keep only the accessible name. */
  heading?: string;
  className?: string;
}

/** Browse entry points: each chip is a link to `/doctors/<mode>?specialty=<key>`. */
export function SpecialtyChips({ mode = 'remote', selected, heading, className }: SpecialtyChipsProps) {
  const t = useTranslations('doctors.browse');
  return (
    <nav aria-label={t('label')} className={className}>
      {heading ? <p className="mb-2 text-sm font-medium text-navy-700">{heading}</p> : null}
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {SPECIALTIES.map((s) => (
          <li key={s.key}>
            <Link
              href={listingHref(`/doctors/${mode}`, { specialty: s.key })}
              aria-current={selected === s.key ? 'true' : undefined}
              className={cx(
                'inline-block rounded-full border border-border px-3.5 py-1.5 font-display text-sm font-medium',
                selected === s.key ? 'border-action bg-action text-action-label' : 'bg-surface text-navy-700 hover:bg-brand-50',
              )}
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
