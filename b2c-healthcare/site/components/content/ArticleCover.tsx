import Image from 'next/image';
import { cx } from '@/components/ui/cx';
import type { SiteImage } from '@/lib/site-images';

/** Decorative cover: the seeded photo when there is one, else a token-styled gradient block. */
export function ArticleCover({ image, className }: { image: SiteImage | null; className?: string }) {
  const frame = cx('relative aspect-video w-full overflow-hidden rounded-lg', className);
  if (!image) return <div data-cover="placeholder" aria-hidden="true" className={cx(frame, 'bg-(image:--gradient-sky)')} />;
  return (
    <div data-cover="image" className={frame}>
      <Image src={image.url} alt="" fill unoptimized sizes="(min-width: 64rem) 33vw, 100vw" className="object-cover" />
    </div>
  );
}
