import type { ReactElement } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { isAllowedImageUrl } from '@/lib/config/images';

type HeroImageProps = { url: string | null; alt: string };

const FRAME = 'relative aspect-[4/3] w-full overflow-hidden rounded-lg';

/** The 4:3 hero picture: the category image (priority: it is the LCP element), or a striped placeholder when there is none or its host is not allowed. */
export function HeroImage({ url, alt }: HeroImageProps): ReactElement {
  const t = useTranslations('home.hero');
  if (url === null || !isAllowedImageUrl(url)) {
    return (
      <div
        role="img"
        aria-label={t('imageLabel')}
        className={`${FRAME} bg-[repeating-linear-gradient(45deg,var(--color-brand-300)_0_var(--space-5),var(--color-brand-400)_var(--space-5)_calc(var(--space-5)*2))]`}
      />
    );
  }
  return (
    <div className={FRAME}>
      <Image src={url} alt={alt} fill priority sizes="(min-width: 48rem) 35rem, 100vw" className="object-cover" />
    </div>
  );
}
