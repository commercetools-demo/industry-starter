'use client';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { usePathname, useRouter } from '@/i18n/routing';
import { useDebouncedCallback } from '@/lib/useDebouncedCallback';

export const SEARCH_DEBOUNCE_MS = 300;
export const MAX_QUERY_LENGTH = 100;

/**
 * The URL is the state: typing updates `?q=` (debounced 300 ms), Enter updates it at once. Any change drops `page`.
 * `initialQuery` is the trimmed `q` read on the server.
 */
export function SearchInput({ initialQuery = '' }: { initialQuery?: string }) {
  const t = useTranslations('search');
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);

  const navigate = (text: string) => {
    const q = text.trim().slice(0, MAX_QUERY_LENGTH);
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
