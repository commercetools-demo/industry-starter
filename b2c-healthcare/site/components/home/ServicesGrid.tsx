import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/**
 * Services that exist, in design order. Mental health and Second opinion are omitted until designed (D-018);
 * Lab tests is view-only (D-018, D12), so its card goes to the lab results list.
 */
export const SERVICES = [
  { key: 'remote', href: '/doctors/remote' },
  { key: 'office', href: '/doctors/office' },
  { key: 'prescriptions', href: '/prescriptions' },
  { key: 'delivery', href: '/prescriptions' },
  { key: 'labs', href: '/account/labs' },
  { key: 'records', href: '/account' },
] as const;

/** Auto-fit grid (min 250 px): icon tile (52 px), title, one line, and one link per card. */
export function ServicesGrid() {
  const t = useTranslations('home.services');
  return (
    <section id="services" aria-labelledby="home-services-title" className="py-22">
      <div className="mx-auto max-w-content px-5 nav:px-8">
        <div className="mb-10">
          <h2 id="home-services-title" className="font-display text-[length:clamp(1.625rem,3.4vw,2.25rem)] leading-tight font-semibold text-text-heading">
            {t('title')}
          </h2>
          <p className="mt-2 max-w-120 text-neutral-600">{t('sub')}</p>
        </div>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,15.625rem),1fr))] gap-6 p-0">
          {SERVICES.map(({ key, href }) => (
            <li key={key} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-7 transition-shadow hover:border-brand-200 hover:shadow-md">
              <div aria-hidden="true" className="grid size-13 place-items-center rounded-md bg-brand-50 font-display text-md font-semibold text-brand-700">
                {t(`${key}.icon`)}
              </div>
              <h3 className="font-display text-lg font-semibold text-text-heading">{t(`${key}.title`)}</h3>
              <p className="text-sm text-neutral-600">{t(`${key}.text`)}</p>
              <Link href={href} className="mt-auto font-display text-sm font-medium">
                {t(`${key}.cta`)} →
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
