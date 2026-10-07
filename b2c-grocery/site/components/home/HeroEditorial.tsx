import { useTranslations } from 'next-intl';
import { Blob } from '@/components/ui/Blob';
import { Button } from '@/components/ui/Button';
import { Photo } from '@/components/ui/Photo';
import { Tag } from '@/components/ui/Tag';

/** Editorial hero (default): copy on the left over a sage blob, washed 560 px photo on the right. The photo is the LCP image. */
export function HeroEditorial({ imageUrl }: { imageUrl: string }) {
  const t = useTranslations('home.hero');
  return (
    <section data-hero="editorial" className="grid items-center gap-(--space-8) pt-[35px] desktop:grid-cols-[1.05fr_1fr]">
      <div className="relative">
        <Blob className="absolute -top-[60px] -left-[90px] size-[210px] opacity-50" />
        <div className="relative">
          <Tag tone="accent-2">{t('tag')}</Tag>
          <h1 className="mt-(--space-4) mb-0 max-w-[9em] text-[48px] leading-[0.98] tablet:text-[76px]">{t('title')}</h1>
          <p className="mt-(--space-4) mb-0 max-w-[32em] text-[18px] text-text/72">{t('body')}</p>
          <div className="mt-(--space-6) flex flex-wrap gap-(--space-3)">
            <Button href="/shop" className="text-[15px]">
              {t('shop')}
            </Button>
            <Button href="/journal" variant="secondary" className="text-[15px]">
              {t('story')}
            </Button>
          </div>
        </div>
      </div>
      <Photo src={imageUrl} alt={t('imageAlt')} sizes="(min-width: 75rem) 640px, 100vw" priority className="h-[420px] desktop:h-[560px]" />
    </section>
  );
}
