import { useTranslations } from 'next-intl';
import { LinkButton } from '@/components/ui/Button';
import type { SiteImage } from '@/content/images';
import { ROUTES } from '@/lib/site';
import { sizedImage, srcSetFor } from '@/lib/utils';

const HERO_WIDTHS = [640, 960, 1280, 1920];

/** Full-bleed hero; the photo is the LCP element: high priority in the HTML (the browser finds it early), responsive (a phone gets 640-960 px), with an explicit size so it never shifts layout. */
export function Hero({ image }: { image?: SiteImage }) {
  const t = useTranslations('home');
  const srcSet = image ? srcSetFor(image.url, HERO_WIDTHS) : undefined;
  return (
    <section className="hero">
      {image ? (
        // Plain img: the optimizer is off, so srcset is written by hand. Decorative: the heading carries the meaning.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sizedImage(image.url, 1280)} srcSet={srcSet} sizes="100vw" alt="" width={image.width} height={image.height} fetchPriority="high" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : null}
      <div className="wrap">
        <h1>{t('heroTitle')}</h1>
        <p>{t('heroLead')}</p>
        <div className="row">
          <LinkButton variant="white" href={ROUTES.quote}>{t('heroQuote')}</LinkButton>
          <LinkButton variant="outline-white" href={ROUTES.plumbing}>{t('heroExplore')}</LinkButton>
        </div>
      </div>
    </section>
  );
}
