// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// The banner carousel of the Malva home (change add-malva-home, D8). The first slide is in the server HTML (no script needed to see it).
// Previous, next and pause controls (WCAG 2.2.2); rotation stops on hover and on focus inside, and never starts under
// prefers-reduced-motion. A banner without an image shows its text on the theme background.
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { productImageLoader } from '@/components/listing/image-loader';
import { Link } from '@/i18n/routing';
import type { MalvaBannerView } from '@/lib/malva-banners';

export const ROTATE_MS = 6000;
const CONTROL = 'inline-flex size-7 items-center justify-center rounded-full bg-surface text-text-strong hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const reducedMotionNow = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_QUERY).matches;
function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function BannerCarousel({ banners }: { banners: MalvaBannerView[] }) {
  const t = useTranslations('malva.banner');
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => true);
  const count = banners.length;

  const rotating = count > 1 && !paused && !hovered && !focused && !reduced;
  useEffect(() => {
    if (!rotating) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(timer);
  }, [rotating, count]);

  if (count === 0) return null;
  const current = Math.min(index, count - 1);
  const banner = banners[current];
  const step = (delta: number) => setIndex((current + delta + count) % count);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('label')}
      className="relative isolate overflow-hidden bg-surface-brand-deep text-text-on-brand"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div role="group" aria-roledescription="slide" aria-label={t('slideLabel', { current: current + 1, total: count })} aria-live={rotating ? 'off' : 'polite'} className="relative">
        {banner.image ? (
          <Image
            key={banner.image.url}
            loader={productImageLoader}
            src={banner.image.url}
            alt=""
            fill
            sizes="100vw"
            priority={current === 0}
            className="-z-10 object-cover opacity-50"
          />
        ) : null}
        <div className="mx-auto flex max-w-content flex-col items-start gap-3 px-5 pb-9 pt-8">
          <h2 className="max-w-prose font-display text-4xl font-semibold leading-tight text-text-on-brand">{banner.headline}</h2>
          {banner.subline ? <p className="max-w-prose font-body text-md leading-normal text-text-on-brand">{banner.subline}</p> : null}
          {banner.categorySlug ? (
            <Link
              href={`/categories/${banner.categorySlug}`}
              className="inline-flex min-h-7 items-center justify-center rounded-pill bg-surface px-6 font-display text-sm font-semibold text-action hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {t('cta')}
            </Link>
          ) : null}
        </div>
      </div>
      {count > 1 ? (
        <div className="absolute right-5 top-4 flex items-center gap-2">
          <button type="button" className={CONTROL} aria-label={t('previous')} onClick={() => step(-1)}>
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" className={CONTROL} aria-label={paused ? t('play') : t('pause')} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
          </button>
          <button type="button" className={CONTROL} aria-label={t('next')} onClick={() => step(1)}>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
