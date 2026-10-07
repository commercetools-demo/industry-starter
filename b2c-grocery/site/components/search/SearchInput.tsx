'use client';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { usePathname, useRouter } from '@/i18n/routing';
import { MAX_QUERY_LENGTH } from '@/lib/search-query';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The URL is the state: typing updates `?q=` (debounced 300 ms), Enter updates it at once. Any change drops `page`.
 * `initialQuery` is the trimmed `q` read on the server.
 */
export function SearchInput({ initialQuery = '' }: { initialQuery?: string }) {
  const t = useTranslations('search');
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);
  const lastNavigated = useRef(initialQuery);

  // A link elsewhere on the page (a suggestion tag) changed `?q=`: show it. Our own navigations are ignored so a
  // slower server render never overwrites what the shopper has typed since.
  useEffect(() => {
    if (initialQuery !== lastNavigated.current) {
      lastNavigated.current = initialQuery;
      setValue(initialQuery);
    }
  }, [initialQuery]);

  const navigate = (text: string) => {
    const q = text.trim().slice(0, MAX_QUERY_LENGTH);
    lastNavigated.current = q;
    router.replace(q ? `${pathname}?${new URLSearchParams({ q }).toString()}` : pathname);
  };
  const [navigateLater, cancel] = useDebouncedCallback(navigate, SEARCH_DEBOUNCE_MS);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
    navigateLater(event.target.value);
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    cancel();
    navigate(value);
  };

  return (
    <form role="search" onSubmit={onSubmit} className="relative">
      <Icon icon={Search} size={22} className="pointer-events-none absolute top-1/2 left-6 -translate-y-1/2 text-muted" />
      <input
        type="search"
        name="q"
        value={value}
        onChange={onChange}
        maxLength={MAX_QUERY_LENGTH}
        aria-label={t('inputLabel')}
        placeholder={t('inputLabel')}
        autoComplete="off"
        enterKeyHint="search"
        className="input h-[58px] text-[20px] ps-14 pe-6"
      />
    </form>
  );
}
