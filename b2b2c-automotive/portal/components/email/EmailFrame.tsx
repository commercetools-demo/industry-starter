import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { Brand } from '@/hooks/marketingApi';

/** Decodes the five entities the server escapes, so text can be rendered as React text nodes (never as HTML). */
export function decodeEntities(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/** The escaped preview body of the server (`<br>` is the only markup) as text lines with line breaks. */
export function EmailText({ html }: { html: string }) {
  const lines = html.split('<br>');
  return (
    <>
      {lines.map((line, index) => (
        <span key={index}>
          {index > 0 ? <br /> : null}
          {decodeEntities(line)}
        </span>
      ))}
    </>
  );
}

/**
 * The frame of an e-mail preview: the store logo (when it has one) on a band in the store's primary colour. The colour is the
 * sanitised `#rrggbb` of the server and reaches the page only as the inline background colour.
 */
export function EmailFrame({ brand, children }: { brand: Brand; children: ReactNode }) {
  const t = useTranslations('email.preview');
  return (
    <div className="overflow-hidden rounded-200 border border-border bg-bg-surface">
      <div className="flex min-h-1200 items-center gap-300 px-400 py-300 text-text-on" style={{ backgroundColor: brand.primary }}>
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the logo is a store-chosen URL, so it is not optimised
          <img src={brand.logoUrl} alt={t('logoAlt', { store: brand.storeName })} className="max-h-1000 w-auto" />
        ) : null}
        <span className="text-body-2 font-bold">{brand.storeName}</span>
      </div>
      <div className="p-500 text-body-2 text-text">{children}</div>
    </div>
  );
}
