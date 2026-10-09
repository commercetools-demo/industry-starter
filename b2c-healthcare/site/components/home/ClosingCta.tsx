import { useTranslations } from 'next-intl';
import { ButtonLink } from '@/components/ui/Button';
import type { SiteImage } from '@/lib/site-images';
import { HomeImage } from './HomeImage';

/**
 * Band before the footer: the `home-cta` photo under the brand gradient (the overlay keeps the navy heading readable),
 * or the plain gradient while no photo is chosen. It does not imply emergency care: the footer under it carries the
 * "Not for emergencies" line on every width (components/layout/Footer.tsx).
 */
export function ClosingCta({ image = null }: { image?: SiteImage | null }) {
  const t = useTranslations('home.cta');
  return (
    <section aria-labelledby="home-cta-title" className="pb-22">
      <div className="mx-auto max-w-content px-5 nav:px-8">
        <HomeImage image={image} className="rounded-xl">
          {image ? <div aria-hidden="true" className="absolute inset-0 bg-(image:--gradient-brand) opacity-90" /> : null}
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
