import Image from 'next/image';
import { cx } from './cx';

type PhotoProps = {
  /** Image URL; an empty string renders the neutral placeholder. */
  src: string;
  /** Required: pass `""` only for purely decorative photos. */
  alt: string;
  /** Required with `fill`: tells the browser which width it will render at. */
  sizes: string;
  /** Set on the above-the-fold image only. */
  priority?: boolean;
  /** CSS aspect-ratio, e.g. `"4 / 5"`. The caller can also size the box with `className`. */
  aspectRatio?: string;
  className?: string;
};

/** Rounded (lg x 1.15) and washed content photograph. The wrapper is `position: relative`; the image fills it. */
export function Photo({ src, alt, sizes, priority, aspectRatio, className }: PhotoProps) {
  return (
    <div
      className={cx('washed relative overflow-hidden bg-neutral-200 rounded-[calc(var(--radius-lg)*1.15)]', className)}
      style={aspectRatio ? { aspectRatio } : undefined}
      {...(src ? {} : { 'data-placeholder': 'true', role: 'img', 'aria-label': alt || undefined, 'aria-hidden': alt ? undefined : true })}
    >
      {src ? <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" /> : null}
    </div>
  );
}
