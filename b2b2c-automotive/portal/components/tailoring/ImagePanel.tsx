'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { buttonSecondary, buttonSmall, errorNote, hintClass, inputClass, labelClass } from '@/components/catalog/ui';
import { tailoringApi } from '@/hooks/catalogApi';
import { MAX_IMAGES } from '@/lib/catalog/tailoring-schema';
import type { ImageRef } from '@/lib/catalog/types';

function Thumb({ image, alt }: { image: ImageRef; alt: string }) {
  // Remote tailored images have no known host list, so the plain element is used (sizes are set by the tokens below).
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.url} alt={alt} className="size-1200 flex-none rounded-200 border border-border-subdued bg-bg-surface-subdued object-cover" />;
}

/**
 * Images of one product: the master images (read-only), and the store's tailored images. A tailored image is added by upload or by
 * pasting an https address (both validated on the server: JPG, PNG or WebP, at least 600 x 600 px, at most 10 MB), removed and moved
 * up or down; the first one is the primary image. "Use master images" clears only the images. Nothing is saved here: the editor's
 * Save sends the array, and saving publishes at once.
 */
export function ImagePanel({
  storeKey,
  productId,
  master,
  value,
  onChange,
  canEdit,
}: {
  storeKey: string;
  productId: string;
  master: ImageRef[];
  value: ImageRef[];
  onChange: (images: ImageRef[]) => void;
  canEdit: boolean;
}) {
  const t = useTranslations('catalog.productInfo.images');
  const tp = useTranslations('permissions');
  const urlId = useId();
  const fileId = useId();
  const [url, setUrl] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const full = value.length >= MAX_IMAGES;

  const add = (image: ImageRef) => onChange([...value, image]);
  const move = (from: number, to: number) => {
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  async function addByUrl() {
    if (!url.trim()) return;
    setBusy(true);
    setProblem('');
    const result = await tailoringApi.checkUrl(storeKey, productId, url.trim());
    setBusy(false);
    if (!result.ok || !result.data) return setProblem(result.error ?? t('errors.generic'));
    add({ url: result.data.url, width: result.data.width, height: result.data.height });
    setUrl('');
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setProblem('');
    const result = await tailoringApi.upload(storeKey, productId, file);
    setBusy(false);
    if (!result.ok || !result.data) return setProblem(result.error ?? t('errors.generic'));
    add({ url: result.data.url, width: result.data.width, height: result.data.height });
  }

  return (
    <div className="flex flex-col gap-400">
      <div>
        <h3 className="text-body-2 font-bold text-text">{t('master')}</h3>
        {master.length ? (
          <ul className="mt-200 flex flex-wrap gap-200">
            {master.map((image, i) => (
              <li key={image.url}>
                <Thumb image={image} alt={t('masterAlt', { n: i + 1 })} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={hintClass}>{t('noMaster')}</p>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-200">
          <h3 className="text-body-2 font-bold text-text">{t('yours')}</h3>
          <button type="button" className={buttonSmall} disabled={!canEdit || value.length === 0} onClick={() => onChange([])}>
            {t('useMaster')}
          </button>
        </div>
        {value.length === 0 ? <p className={`mt-100 ${hintClass}`}>{t('usingMaster')}</p> : null}
        <ol className="mt-200 flex flex-col gap-200">
          {value.map((image, i) => (
            <li key={`${image.url}-${i}`} className="flex items-center gap-300 rounded-300 border border-border-subdued p-200">
              <Thumb image={image} alt={t('yoursAlt', { n: i + 1 })} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-caption-1 font-medium text-text">{image.url}</p>
                <p className={hintClass}>
                  {i === 0 ? t('primary') : t('position', { n: i + 1 })}
                  {image.width && image.height ? ` · ${image.width} x ${image.height}` : ''}
                </p>
              </div>
              <div className="flex flex-none gap-100">
                <button type="button" className={buttonSmall} aria-label={t('moveUp', { n: i + 1 })} disabled={!canEdit || i === 0} onClick={() => move(i, i - 1)}>
                  ↑
                </button>
                <button type="button" className={buttonSmall} aria-label={t('moveDown', { n: i + 1 })} disabled={!canEdit || i === value.length - 1} onClick={() => move(i, i + 1)}>
                  ↓
                </button>
                <button type="button" className={buttonSmall} aria-label={t('remove', { n: i + 1 })} disabled={!canEdit} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  {t('removeShort')}
                </button>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {canEdit ? (
        <div className="flex flex-col gap-300">
          <div className="flex flex-col gap-150">
            <label htmlFor={urlId} className={labelClass}>
              {t('addByUrl')}
            </label>
            <div className="flex gap-200">
              <input id={urlId} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" disabled={full || busy} className={inputClass} />
              <button type="button" className={buttonSecondary} disabled={full || busy || url.trim() === ''} onClick={addByUrl}>
                {t('add')}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-150">
            <label htmlFor={fileId} className={labelClass}>
              {t('upload')}
            </label>
            <input id={fileId} type="file" accept="image/jpeg,image/png,image/webp" disabled={full || busy} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} className="text-body-2" />
            <p className={hintClass}>{t('limits')}</p>
          </div>
          {full ? <p className={hintClass}>{t('full', { max: MAX_IMAGES })}</p> : null}
          {problem ? (
            <p role="alert" className={errorNote}>
              {problem}
            </p>
          ) : null}
        </div>
      ) : (
        <p role="note" className={hintClass}>
          {tp('insufficient')}
        </p>
      )}
    </div>
  );
}
