import Image from 'next/image';
import { cx } from '@/components/ui/cx';
import type { SiteImage } from '@/lib/site-images';

/**
 * Decorative home image from a `site-images.json` slot: the seeded photo (clean URL, no query string) or a
 * token-styled gradient block while no photo has been chosen. Never an invented URL. Children (the hero's
 * floating chip) are positioned over it.
 */
export function HomeImage({
  image,
  className,
  gradient = 'bg-(image:--gradient-brand)',
  children,
}: {
  image: SiteImage | null;
  className?: string;
  gradient?: string;
  children?: React.ReactNode;
}) {
  return (
    <div data-image={image ? 'photo' : 'placeholder'} className={cx('relative overflow-hidden', className, !image && gradient)}>
      {image ? <Image src={image.url} alt="" fill unoptimized priority={false} sizes="(min-width: 56rem) 50vw, 100vw" className="object-cover" /> : null}
      {children}
    </div>
  );
}
