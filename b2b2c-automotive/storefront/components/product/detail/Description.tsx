// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';

/** Paragraphs of a description: split on blank lines, trimmed, empty ones dropped. Rendered as text (D7), never as HTML. */
export const paragraphsOf = (text: string | null): string[] =>
  (text ?? '')
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);

/**
 * The tailored (or master) description as plain paragraphs, then the fitment disclaimer, which always renders (a superset of
 * "when the text is tailored", D7). React escapes the text: markup in a description shows literally.
 */
export function Description({ description }: { description: string | null }) {
  const t = useTranslations('pdp');
  const paragraphs = paragraphsOf(description);
  return (
    <section aria-labelledby="pdp-description" className="grid gap-3">
      <h2 id="pdp-description" className="m-0 font-display text-lg font-semibold text-text">
        {t('description')}
      </h2>
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="m-0 max-w-prose font-body text-sm leading-normal text-text-body">
          {paragraph}
        </p>
      ))}
      <p className="m-0 max-w-prose font-ui text-xs text-text-muted">{t('fitDisclaimer')}</p>
    </section>
  );
}
