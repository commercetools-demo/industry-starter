'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { fetchJson } from '@/hooks/fetcher';

export const FEEDBACK_TIMEOUT_MS = 3000;

/**
 * "Was this helpful?" The thanks text appears only after the server answers `{ recorded: true }`.
 * Any other result (error, network failure, 3 s timeout) shows nothing and the vote is discarded, so a lost vote
 * never claims to have been recorded.
 */
export default function FaqFeedback({ questionId, locale }: { questionId: string; locale: string }) {
  const t = useTranslations('faq');
  const [thanks, setThanks] = useState(false);

  async function vote(helpful: boolean) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FEEDBACK_TIMEOUT_MS);
    try {
      const res = await fetchJson<{ recorded?: boolean }>('/api/faq-feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId, helpful, locale }),
        signal: controller.signal,
      });
      if (res.recorded === true) setThanks(true);
    } catch {
      // Discarded on purpose: show nothing.
    } finally {
      clearTimeout(timer);
    }
  }

  return (
    <div aria-live="polite" className="flex items-center gap-3 border-t border-line py-3 text-[13px] text-ink-2">
      {thanks ? (
        <p className="m-0">{t('thanks')}</p>
      ) : (
        <>
          <span id={`helpful-${questionId}`}>{t('helpful')}</span>
          <button
            type="button"
            aria-describedby={`helpful-${questionId}`}
            onClick={() => void vote(true)}
            className="min-h-9 cursor-pointer rounded-pill border border-line-2 bg-surface px-4 text-ink hover:border-ink"
          >
            {t('yes')}
          </button>
          <button
            type="button"
            aria-describedby={`helpful-${questionId}`}
            onClick={() => void vote(false)}
            className="min-h-9 cursor-pointer rounded-pill border border-line-2 bg-surface px-4 text-ink hover:border-ink"
          >
            {t('no')}
          </button>
        </>
      )}
    </div>
  );
}
