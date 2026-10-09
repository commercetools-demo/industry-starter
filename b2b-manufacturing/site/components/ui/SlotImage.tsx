import { sizedImage, srcSetFor } from '@/lib/utils';
import { getSiteImage, type ImageSlot } from '@/content/images';

/** The managed photo for a named slot. Decorative (empty alt): the heading next to it carries the meaning. Falls back to the striped placeholder when the slot has no photo. */
export function SlotImage({ slot, height = 380, className }: { slot: ImageSlot; height?: number; className?: string }) {
  const image = getSiteImage(slot);
  if (!image) return <div className={`ph ${className ?? ''}`} data-image-slot={slot} aria-hidden="true" style={{ minHeight: height }} />;
  return (
    // Plain img: the optimizer is off (commercetools and stock-photo URLs are used as they are). Size is set so nothing shifts.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={sizedImage(image.url, 1200)} srcSet={srcSetFor(image.url, [480, 800, 1200])} sizes="(max-width: 900px) 100vw, 640px" width={image.width} height={image.height} alt="" loading="lazy" data-image-slot={slot} className={className} style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />
  );
}
