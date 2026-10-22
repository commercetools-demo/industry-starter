'use client';

import { useTranslations } from 'next-intl';
import { forwardRef, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { Input } from '@/components/ui/Field';

interface StoreSearchProps {
  /** Called with the typed text 150 ms after the last keystroke. */
  onQuery: (query: string) => void;
  onUseLocation: () => void;
  locationOff: boolean;
  locating: boolean;
}

const DEBOUNCE_MS = 150;

/** Search box with an opt-in "Use my location" button (the browser asks only on click). */
const StoreSearch = forwardRef<HTMLInputElement, StoreSearchProps>(function StoreSearch(
  { onQuery, onUseLocation, locationOff, locating },
  ref,
) {
  const t = useTranslations('store.picker');
  const [text, setText] = useState('');

  useEffect(() => {
    const id = setTimeout(() => onQuery(text), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text, onQuery]);

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon name="search" size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
          <Input
            ref={ref}
            shape="pill"
            type="search"
            name="store-search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label={t('searchLabel')}
            placeholder={t('searchPlaceholder')}
            className="pl-10"
            autoComplete="off"
          />
        </div>
        <Button type="button" variant="ghost" onClick={onUseLocation} loading={locating} className="px-4!">
          <Icon name="pin" size={16} />
          {t('useLocation')}
        </Button>
      </div>
      {locationOff ? (
        <p role="status" className="m-0 mt-2 text-[13px] text-ink-3">
          {t('locationOff')}
        </p>
      ) : null}
    </div>
  );
});

export default StoreSearch;
