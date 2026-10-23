'use client';

import { useTranslations } from 'next-intl';

/** "{n}/{max}" under a field. `aria-live="off"` keeps typing silent; the counter is read when the field is revisited. */
export default function FieldCounter({ id, value, max }: { id: string; value: string; max: number }) {
  const t = useTranslations('reviews.form');
  const n = [...value].length;
  return (
    <p id={id} aria-live="off" className={`m-0 mt-1 text-right text-[12px] ${n >= max ? 'font-semibold text-ink' : 'text-ink-3'}`}>
      {t('count', { n, max })}
    </p>
  );
}
