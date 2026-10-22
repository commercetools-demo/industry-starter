'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRef, useState, type KeyboardEvent } from 'react';
import SaveButton from '@/components/product/SaveButton';
import Badge from '@/components/ui/Badge';
import { usePdp } from '@/components/pdp/pdp-state';
import { transformDetailImageUrl, transformThumbnailImageUrl } from '@/lib/ct/image-config';
import { cn } from '@/lib/cn';
import type { CardBadge } from '@/lib/types';

const BADGE_KEY: Record<CardBadge, 'bestseller' | 'new' | 'limitedEdition' | 'subscribe'> = {
  bestseller: 'bestseller', new: 'new', 'limited-edition': 'limitedEdition', subscribe: 'subscribe',
};

/**
 * Thumbnails, main image, badge and heart (workstream H, 3.5). Images come from the selected variant (the mapper falls
 * back to the product images when a variant has none), so choosing a colour swaps the set and resets the selected thumbnail.
 * Thumbnails are tab stops and also answer the arrow keys; the main image is not interactive (no zoom in v1).
 */
export default function Gallery() {
  const t = useTranslations('pdp');
  const tCard = useTranslations('card');
  const { data, preview } = usePdp();
  const { product } = data;
  const images = preview.images;
  const setKey = images.map((i) => i.url).join('|');
  const [state, setState] = useState({ key: setKey, index: 0 });
  const index = state.key === setKey ? Math.min(state.index, Math.max(0, images.length - 1)) : 0;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = images[index];

  const move = (next: number) => {
    const clamped = (next + images.length) % images.length;
    setState({ key: setKey, index: clamped });
    refs.current[clamped]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (images.length < 2) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      move(index + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      move(index - 1);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-3.5 stack:flex-row-reverse">
      <div className="relative aspect-[5/6] w-full overflow-hidden rounded-panel bg-canvas-2" data-testid="pdp-main-image">
        {current ? (
          <Image
            key={current.url}
            src={transformDetailImageUrl(current.url)}
            alt={current.alt && current.alt !== product.name ? current.alt : t('gallery.alt', { name: product.name, n: index + 1 })}
            fill
            priority={index === 0}
            {...(index === 0 ? { fetchPriority: 'high' as const } : {})}
            sizes="(min-width: 900px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-6 text-center text-[13px] text-ink-3">{t('noPhoto')}</div>
        )}
        {product.badge ? (
          <Badge
            variant={product.badge === 'new' || product.badge === 'limited-edition' ? 'accent' : 'ink'}
            className="absolute left-[18px] top-[18px] z-20"
          >
            {tCard(`badge.${BADGE_KEY[product.badge]}`)}
          </Badge>
        ) : null}
        <SaveButton productId={product.id} name={product.name} className="right-[18px]! top-[18px]! opacity-100! bg-surface/85!" />
      </div>
      {images.length > 1 ? (
        <div
          role="group"
          aria-label={t('gallery.label')}
          onKeyDown={onKeyDown}
          className="flex shrink-0 gap-3 overflow-x-auto stack:w-[72px] stack:flex-col stack:overflow-visible"
        >
          {images.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              aria-label={t('gallery.thumb', { n: i + 1, total: images.length })}
              aria-pressed={i === index}
              onClick={() => setState({ key: setKey, index: i })}
              className={cn(
                'transition-state relative h-[88px] w-[72px] shrink-0 overflow-hidden rounded-field border bg-canvas-2 p-0',
                i === index ? 'border-ink' : 'border-transparent hover:border-line-2',
              )}
            >
              <Image src={transformThumbnailImageUrl(img.url)} alt="" fill sizes="72px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
