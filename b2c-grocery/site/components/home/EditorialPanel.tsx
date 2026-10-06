import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Photo } from '@/components/ui/Photo';
import { EDITORIAL_IMAGE_URL } from '@/lib/config/home-images';

/** Journal teaser: accent-2-700 panel (radius lg x 1.6, padding 35 px), copy left, 380 px photo on accent-2-300 right. */
export function EditorialPanel() {
  const t = useTranslations('home.editorial');
  return (
    <section data-section="editorial" className="grid items-center gap-(--space-8) rounded-[calc(var(--radius-lg)*1.6)] bg-accent-2-700 p-[35px] desktop:grid-cols-2">
      <div>
        <p className="m-0 text-[12px] tracking-[0.1em] text-accent-2-200 uppercase">{t('kicker')}</p>
        <h2 className="mt-(--space-3) mb-(--space-4) text-[34px] leading-[1.05] text-bg tablet:text-[44px]">{t('title')}</h2>
        <p className="mt-0 mb-(--space-6) max-w-[32em] text-[17px] text-bg/85">{t('body')}</p>
        <Button href="/journal" className="bg-bg text-accent-2-800 hover:bg-neutral-100">
          {t('button')}
        </Button>
      </div>
      <Photo src={EDITORIAL_IMAGE_URL} alt={t('imageAlt')} sizes="(min-width: 75rem) 600px, 100vw" className="h-[380px] bg-accent-2-300" />
    </section>
  );
}
