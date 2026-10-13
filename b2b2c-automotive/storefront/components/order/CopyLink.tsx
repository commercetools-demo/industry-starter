// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { INPUT_CLASS } from '@/components/ui/Field';

/** The origin never changes while the page is open: nothing to subscribe to. */
const subscribeNothing = () => () => undefined;

/**
 * The private link of a guest's confirmation page (nothing is emailed, owner decision Q-P01): the link in a read-only field and a Copy
 * button. The clipboard API is used when it exists; otherwise the field is selected so the shopper can copy it by hand.
 * `path` is the locale-prefixed path with the `?t=` token; the origin is added in the browser.
 */
export function CopyLink({ path }: { path: string }) {
  const t = useTranslations('order.link');
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  // The origin only exists in the browser: the server and the first client render show the path, then the full address.
  const origin = useSyncExternalStore(subscribeNothing, () => window.location.origin, () => '');
  const href = origin ? new URL(path, origin).toString() : path;

  async function copy() {
    const absolute = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(absolute);
      setState('copied');
    } catch {
      requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.select();
      });
      setState('manual');
    }
  }

  return (
    <section aria-labelledby="order-link-title" className="grid gap-2 rounded-md border border-border bg-surface p-4">
      <h2 id="order-link-title" className="m-0 font-display text-md font-semibold text-text">
        {t('title')}
      </h2>
      <p className="m-0 font-ui text-sm text-text-muted">{t('hint')}</p>
      <div className="flex flex-wrap gap-2">
        <input ref={input} readOnly aria-label={t('label')} value={href} onFocus={(event) => event.currentTarget.select()} className={`${INPUT_CLASS} min-w-0 flex-1 truncate`} />
        <Button variant="secondary" onClick={() => void copy()}>
          {t('copy')}
        </Button>
      </div>
      <p role="status" className="m-0 min-h-5 font-ui text-xs text-text-body">
        {state === 'copied' ? t('copied') : state === 'manual' ? t('copyFailed') : ''}
      </p>
    </section>
  );
}
