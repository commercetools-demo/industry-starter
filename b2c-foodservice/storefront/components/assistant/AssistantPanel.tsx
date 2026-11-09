'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import AssistantBlock from '@/components/assistant/cards';
import { Composer } from '@/components/assistant/Composer';
import type { UISegment } from '@/components/assistant/protocol';
import { useStickToBottom } from '@/components/assistant/scroll';
import { LatestPill, Transcript } from '@/components/assistant/Transcript';
import Icon from '@/components/ui/Icon';
import { useAssistant } from '@/context/assistant-context';

const STARTERS = ['starter1', 'starter2', 'starter3', 'starter4'] as const;
/** Below the shop's `mobile` breakpoint (820px) the panel is a full-screen sheet. */
const SHEET_QUERY = '(max-width: 819.98px)';

/**
 * The assistant panel: a floating dock on wide screens (no aria-modal, no focus trap, no scroll lock: the page stays usable), a
 * full-screen sheet on narrow ones (scroll locked while open). Escape closes and returns focus to the launcher.
 */
export default function AssistantPanel() {
  const t = useTranslations('assistant');
  const { enabled, isOpen, close, status, items, busy, send, addFromCard, cartCount, launcherRef } = useAssistant();
  const { scrollRef, onScroll, showLatest, jumpToLatest } = useStickToBottom(items, busy);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      launcherRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, close, launcherRef]);

  // Scroll lock only while the sheet is showing.
  useEffect(() => {
    if (!isOpen) return;
    const media = window.matchMedia(SHEET_QUERY);
    const apply = () => {
      document.body.style.overflow = media.matches ? 'hidden' : '';
    };
    apply();
    media.addEventListener('change', apply);
    return () => {
      media.removeEventListener('change', apply);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!enabled || !isOpen) return null;

  const renderBlock = (segment: UISegment) => <AssistantBlock block={segment.block} status={segment.status} onAdd={addFromCard} />;

  return (
    <aside
      id="assistant-panel"
      aria-label={t('panel.title')}
      className="assistant-scope fixed inset-0 z-80 flex flex-col bg-canvas text-ink mobile:inset-auto mobile:bottom-4 mobile:right-4 mobile:z-70 mobile:h-[min(680px,calc(100dvh-6rem))] mobile:w-[420px] mobile:rounded-panel mobile:border mobile:border-line mobile:shadow-lg"
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon name="sparkle" size={18} className="text-accent" />
        <h2 className="m-0 min-w-0 flex-1 truncate text-base font-semibold">{t('panel.title')}</h2>
        {cartCount > 0 ? (
          <span className="rounded-pill bg-canvas-2 px-2.5 py-1 text-xs font-semibold text-ink-2">
            {t('panel.cartCount', { count: cartCount })}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => {
            close();
            launcherRef.current?.focus();
          }}
          aria-label={t('panel.close')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-pill text-ink hover:bg-ink/6"
        >
          <Icon name="x" size={18} />
        </button>
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="panel-scroll relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
      >
        {status === 'unavailable' ? (
          <p role="alert" className="rounded-field border border-line bg-surface px-3 py-2 text-sm text-ink-2">
            {t('errors.unavailable')}
          </p>
        ) : null}
        {items.length === 0 && status !== 'unavailable' ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm text-ink-2">{t('welcome')}</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((key) => (
                <button key={key} type="button" className="chip" onClick={() => send(t(`starters.${key}`))}>
                  {t(`starters.${key}`)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <Transcript items={items} busy={busy} send={send} renderBlock={renderBlock} />
        {showLatest ? <LatestPill onClick={jumpToLatest} /> : null}
      </div>

      <div className="border-t border-line p-3">
        <Composer
          send={send}
          ready={status === 'ready' || status === 'starting' || status === 'idle'}
          busy={busy}
          label={t('composer.label')}
          placeholder={t('composer.placeholder')}
        />
        <p className="m-0 mt-2 text-center text-[11px] text-ink-3">{t('panel.disclaimer')}</p>
      </div>
    </aside>
  );
}
