import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { CITIES, SPECIALTIES } from '@/lib/specialties';
import { hasActiveFilters, listingHref, type ListingState } from '@/lib/listing-url';
import type { ConsultationMode, DoctorListItem } from '@/lib/types';
import { DoctorCard } from './DoctorCard';
import { SpecialtyChips } from './SpecialtyChips';

/** Active filters, each one a link that removes only that filter. */
export function ActiveFilters({ mode, state }: { mode: ConsultationMode; state: ListingState }) {
  const t = useTranslations('doctors');
  const path = `/doctors/${mode}`;
  const chips: { key: string; label: string; next: Partial<ListingState> }[] = [];
  if (state.q) chips.push({ key: 'q', label: `“${state.q}”`, next: { ...state, q: '', page: 1 } });
  if (state.specialty) {
    chips.push({ key: 'specialty', label: SPECIALTIES.find((s) => s.key === state.specialty)?.label ?? state.specialty, next: { ...state, specialty: '', page: 1 } });
  }
  if (mode === 'office' && state.city) {
    chips.push({ key: 'city', label: CITIES.find((c) => c.key === state.city)?.label ?? state.city, next: { ...state, city: '', page: 1 } });
  }
  if (state.today) chips.push({ key: 'today', label: t('filters.today'), next: { ...state, today: false, page: 1 } });
  if (chips.length === 0) return null;
  return (
    <ul aria-label={t('activeFilters')} className="m-0 flex list-none flex-wrap gap-2 p-0">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={listingHref(path, chip.next)}
            aria-label={t('removeFilter', { name: chip.label })}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800 hover:bg-brand-100"
          >
            {chip.label}
            <span aria-hidden="true">×</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The cards, or the no-match card (with the way back: clear filters, browse by specialty). */
export function DoctorList({ items, mode, state }: { items: DoctorListItem[]; mode: ConsultationMode; state: ListingState }) {
  const t = useTranslations('doctors.empty');
  if (items.length === 0) {
    return (
      <Card data-testid="no-match" className="grid gap-4 text-neutral-600">
        <p>{t('title')}</p>
        {hasActiveFilters(state, mode) ? (
          <div>
            <ButtonLink href={`/doctors/${mode}`} variant="outline" size="sm">
              {t('clear')}
            </ButtonLink>
          </div>
        ) : null}
        <SpecialtyChips mode={mode} heading={t('browse')} />
      </Card>
    );
  }
  return (
    <ul className="m-0 grid list-none gap-4 p-0">
      {items.map((doctor) => (
        <li key={doctor.key}>
          <DoctorCard doctor={doctor} mode={mode} from={listingHref(`/doctors/${mode}`, state)} />
        </li>
      ))}
    </ul>
  );
}
