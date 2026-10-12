// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRef, useState, type KeyboardEvent } from 'react';
import { productImageLoader } from '@/components/listing/image-loader';
import type { ProductImage } from '@/lib/types';

/**
 * The product photos (workstream M): one large 4:3 image (the first has `priority`, it is the LCP) and, with more than one image,
 * thumbnails that switch it. Thumbnails are buttons (`aria-pressed`); the arrow keys move between them. Without any image the
 * frame keeps its shape and says "No photo".
 */
export function Gallery({ images }: { images: ProductImage[] }) {
  const t = useTranslations('pdp');
  const [index, setIndex] = useState(0);
  const thumbs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = images[Math.min(index, images.length - 1)];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, from: number) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (from + step + images.length) % images.length;
    thumbs.current[next]?.focus();
  }

  return (
    <section aria-label={t('galleryLabel')} className="grid content-start gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-surface-subtle">
        {current ? (
          <Image key={current.url} loader={productImageLoader} src={current.url} alt={current.alt} fill priority={index === 0} sizes="(min-width: 42.5rem) 50vw, 100vw" className="object-contain" />
        ) : (
          <span className="flex size-full items-center justify-center font-ui text-sm text-text-subtle">{t('noPhoto')}</span>
        )}
      </div>
      {images.length > 1 ? (
        <ul className="m-0 grid list-none grid-cols-4 gap-3 p-0">
          {images.map((image, i) => (
            <li key={`${image.url}-${i}`}>
              <button
                ref={(el) => {
                  thumbs.current[i] = el;
                }}
                type="button"
                aria-label={t('showImage', { n: i + 1 })}
                aria-pressed={i === index}
                onClick={() => setIndex(i)}
                onKeyDown={(event) => onKeyDown(event, i)}
                className={`relative block aspect-[4/3] w-full overflow-hidden rounded-md border bg-surface-subtle ${i === index ? 'border-border-brand' : 'border-border'}`}
              >
                <Image loader={productImageLoader} src={image.url} alt="" fill sizes="25vw" className="object-contain" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
