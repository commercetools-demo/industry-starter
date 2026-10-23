'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import IconButton from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Field';
import { useRouter } from '@/i18n/routing';

/** Search icon that reveals a pill input across the header; submit goes to /search?q= (rendered by G). */
export default function SearchToggle() {
  const t = useTranslations('shell.search');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const show = () => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    opener.current?.focus();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <>
      <IconButton label={t('open')} icon="search" onClick={show} aria-expanded={open} />
      {open ? (
        <form
          role="search"
          onSubmit={submit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
          }}
          className="absolute inset-x-0 top-0 z-10 flex h-[72px] items-center gap-2 bg-canvas"
        >
          <div className="wrap flex items-center gap-2">
            <Input
              ref={input}
              shape="pill"
              type="search"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('placeholder')}
              aria-label={t('label')}
              autoComplete="off"
            />
            <IconButton type="submit" label={t('submit')} icon="search" />
            <IconButton label={t('close')} icon="x" onClick={close} />
          </div>
        </form>
      ) : null}
    </>
  );
}
