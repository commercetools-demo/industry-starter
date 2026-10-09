import { useTranslations } from 'next-intl';
import { SearchForm } from '@/components/search/SearchForm';
import { Link } from '@/i18n/routing';
import { listingHref } from '@/lib/listing-url';
import { HomeImage } from './HomeImage';

/**
 * The prototype's four chips minus Mental health (D-018: hidden until designed), keyed by the doctor
 * specialty enum so each chip is a link to the filtered list.
 */
export const HERO_CHIPS = ['general-practice', 'dermatology', 'pediatrics'] as const;

export interface HeroProps {
  /** Live count of doctors with a free slot today; null (no source) hides the floating chip. */
  availableToday: number | null;
}

/** Sky hero: H1, lead, search (to /search?q=, empty submit stays), specialty chips, and the 460 px banner area. */
export function Hero({ availableToday }: HeroProps) {
  const t = useTranslations('home.hero');
  return (
    <section aria-labelledby="home-hero-title" className="overflow-hidden bg-(image:--gradient-sky) pt-18">
      <div className="mx-auto grid max-w-content items-end gap-12 px-5 nav:grid-cols-[1.1fr_1fr] nav:px-8">
        <div className="pb-12 nav:pb-18">
          <h1
            id="home-hero-title"
            className="font-display text-[length:clamp(2.125rem,5vw,3.25rem)] leading-tight font-semibold text-navy-900"
          >
            {t('title')}
          </h1>
          <p className="mt-5 mb-7 max-w-130 text-[length:var(--text-lg)] text-neutral-600">{t('lead')}</p>
          <SearchForm required className="flex max-w-140 gap-2 rounded-md bg-surface p-2 shadow-md" />
          <nav aria-label={t('chipsLabel')} className="mt-4">
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0 font-meta text-sm">
              {HERO_CHIPS.map((key) => (
                <li key={key}>
                  <Link
                    href={listingHref('/doctors/remote', { specialty: key })}
                    className="inline-block rounded-sm bg-surface px-3 py-1.25 text-navy-700 hover:bg-brand-50 hover:text-navy-900"
                  >
                    {t(`chips.${key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <HomeImage className="h-75 rounded-t-xl nav:h-115">
          {availableToday === null ? null : (
            <p
              data-testid="hero-available-chip"
              className="absolute top-20 left-6 m-0 flex items-center gap-2.5 rounded-lg bg-surface px-4 py-3 font-display text-sm font-medium text-navy-900 shadow-md"
            >
              <span aria-hidden="true" className="size-2.25 rounded-full bg-success-500" />
              {t('availableChip', { count: availableToday })}
            </p>
          )}
        </HomeImage>
      </div>
    </section>
  );
}
