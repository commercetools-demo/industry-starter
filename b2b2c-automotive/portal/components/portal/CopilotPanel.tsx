/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icons/Icon';
import { Link } from '@/i18n/routing';
import { useOverlay } from '@/context/OverlayContext';
import { applyCopilotAction, planCopilot } from '@/hooks/useCopilotApi';

interface Message {
  who: 'user' | 'copilot';
  text: string;
  href?: string;
}
interface Pending {
  actionId: string;
  params: Record<string, string>;
  summary: string;
}

/**
 * Rule-based Copilot (no model, Q-R03). It answers where things are and proposes changes; a change shows its exact
 * summary with Confirm and Cancel and only Confirm calls the server, which re-checks the permission.
 */
export function CopilotPanel() {
  const t = useTranslations('copilot');
  const locale = useLocale();
  const overlay = useOverlay();
  const [log, setLog] = useState<Message[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const open = overlay.isOpen('cp');
  // Focus moves into the panel when it opens (Escape and Close give it back to the launcher through the overlay stack).
  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  const push = (...messages: Message[]) => {
    setLog((l) => [...l, ...messages]);
    queueMicrotask(() => end.current?.scrollIntoView?.({ block: 'end' }));
  };

  async function send() {
    const q = text.trim();
    if (!q || busy) return;
    setText('');
    setBusy(true);
    push({ who: 'user', text: q });
    const result = await planCopilot(q, locale);
    setBusy(false);
    if (!result) push({ who: 'copilot', text: t('error') });
    else if (result.kind === 'answer') push({ who: 'copilot', text: result.text, href: result.href });
    else {
      setPending({ actionId: result.actionId, params: result.params, summary: result.summary });
      push({ who: 'copilot', text: result.summary });
    }
  }

  async function confirm() {
    if (!pending) return;
    const current = pending;
    setPending(null);
    setBusy(true);
    const result = await applyCopilotAction(current.actionId, current.params);
    setBusy(false);
    push({ who: 'copilot', text: result.ok ? t('done', { message: result.message }) : t('failed', { message: result.message }) });
  }

  function cancel() {
    setPending(null);
    push({ who: 'copilot', text: t('cancelled') });
  }

  // The launcher stays mounted (hidden from assistive technology while the panel is open) so that closing the panel can give
  // focus back to it; the panel is rendered before it in the same fragment so the launcher keeps its place in the tree.
  const launcher = (
    <button
      type="button"
      data-testid="copilot-launcher"
      title={t('open')}
      aria-hidden={open || undefined}
      tabIndex={open ? -1 : undefined}
      onClick={(e) => overlay.open('cp', e.currentTarget)}
      className="fixed bottom-600 right-600 z-40 h-1200 rounded-full bg-bg-brand px-500 text-body-1 font-bold text-text-on shadow-popover hover:bg-bg-brand-hover"
    >
      {t('open')}
    </button>
  );

  const panel = (
    <section role="dialog" aria-label={t('title')} className="fixed bottom-600 right-600 z-60 flex max-h-[72vh] w-widget-desktop-4col max-w-[calc(100vw-var(--space-800))] flex-col gap-200 overflow-y-auto rounded-400 bg-bg-surface p-400 text-text shadow-popover narrow:inset-x-300 narrow:bottom-300 narrow:w-auto narrow:max-w-none">
      <div className="flex items-start justify-between gap-200">
        <div>
          <h2 className="text-title-2 font-semibold">{t('title')}</h2>
          <p className="text-caption-1 font-medium text-text-subdued">{t('subtitle')}</p>
        </div>
        <button type="button" aria-label={t('close')} onClick={() => overlay.close('cp')} className="grid size-800 place-items-center rounded-full hover:bg-bg-surface-hover narrow:size-1100">
          <Icon name="close" size="sm" />
        </button>
      </div>
      <div className="flex flex-col gap-200" aria-live="polite">
        <p className="max-w-[90%] self-start rounded-300 bg-bg-info-subdued px-300 py-250 text-body-2 font-medium">{t('intro')}</p>
        {log.map((m, i) => (
          <p key={i} className={`max-w-[90%] rounded-300 px-300 py-250 text-body-2 font-medium ${m.who === 'user' ? 'self-end bg-bg-surface-hover' : 'self-start bg-bg-info-subdued'}`}>
            {m.text}
            {m.href ? (
              <>
                {' '}
                <Link href={m.href} onClick={() => overlay.close('cp')} className="font-bold text-text-active underline">
                  {m.href}
                </Link>
              </>
            ) : null}
          </p>
        ))}
        <div ref={end} />
      </div>
      {pending ? (
        <div className="flex flex-col gap-200 rounded-300 border border-border p-300">
          <b>{t('confirmTitle')}</b>
          <span className="text-caption-1 font-medium text-text-subdued">{pending.summary}</span>
          <div className="flex gap-200">
            <button type="button" onClick={confirm} className="h-1000 rounded-200 border border-border bg-bg-brand px-300 text-button-2 font-bold text-text-on hover:bg-bg-brand-hover">
              {t('confirm')}
            </button>
            <button type="button" onClick={cancel} className="h-1000 rounded-200 border border-border bg-bg-surface px-300 text-button-2 font-bold text-text hover:bg-bg-surface-hover">
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : null}
      <form
        className="flex gap-200"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          ref={field}
          type="text"
          aria-label={t('placeholder')}
          placeholder={t('placeholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-1100 min-w-0 flex-1 rounded-300 border border-border-input bg-bg-surface px-300 text-body-2 font-semibold text-text"
        />
        <button type="submit" disabled={busy || !text.trim()} className="h-1100 rounded-300 bg-bg-brand px-400 text-body-2 font-bold text-text-on hover:bg-bg-brand-hover disabled:bg-bg-brand-disabled">
          {t('send')}
        </button>
      </form>
    </section>
  );

  return (
    <>
      {open ? panel : null}
      {launcher}
    </>
  );
}
