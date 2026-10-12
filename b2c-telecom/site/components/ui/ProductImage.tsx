import Image from 'next/image';
import type { ReactElement } from 'react';
import { cx } from '@/lib/cx';

type ProductImageProps = {
  /** The offer's image; without one the tile shows the initial of the name on the brand colour. */
  src: string | undefined;
  name: string;
  /** The `sizes` hint of the image (width at each breakpoint). */
  sizes: string;
  className?: string;
};

/** The picture of an add-on tile, 4:3. Decorative: the name is always written next to it, so the image has no alt text. */
export function ProductImage({ src, name, sizes, className }: ProductImageProps): ReactElement {
  return (
    <div className={cx('relative aspect-4/3 w-full overflow-hidden bg-pink-900', className)}>
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-display text-5xl font-bold text-text-on-pink">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}
