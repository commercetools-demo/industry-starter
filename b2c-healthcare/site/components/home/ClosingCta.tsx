import { useTranslations } from 'next-intl';
import { ButtonLink } from '@/components/ui/Button';
import { HomeImage } from './HomeImage';

/**
 * Band before the footer on the brand gradient. It does not imply emergency care: the footer under it carries the
 * "Not for emergencies" line on every width (components/layout/Footer.tsx).
 */
export function ClosingCta() {
  const t = useTranslations('home.cta');
  return (
    <section aria-labelledby="home-cta-title" className="pb-22">
      <div className="mx-auto max-w-content px-5 nav:px-8">
        <HomeImage className="rounded-xl">
          <div className="relative flex flex-wrap items-center justify-between gap-6 p-8 nav:p-14">
            <h2 id="home-cta-title" className="font-display text-[length:clamp(1.625rem,3.4vw,2.25rem)] leading-tight font-semibold text-navy-900">
              {t('title')}
            </h2>
            <ButtonLink href="/doctors/remote" variant="navy">
              {t('button')}
            </ButtonLink>
          </div>
        </HomeImage>
      </div>
    </section>
  );
}
