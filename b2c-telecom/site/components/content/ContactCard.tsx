import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FOCUS_RING } from '@/components/ui/focus';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/config/contact';
import { isContentLocale } from '@/lib/content/types';

/**
 * The only contact channel: an email address and a `mailto:` button (D-034). No form, no storage, no chat, no offices.
 * A plain anchor is used because the locale-aware Link would prefix the `mailto:` address with the locale.
 */
export function ContactCard(): ReactElement {
  const t = useTranslations('content.contact');
  const locale = useLocale();
  const href = supportMailto(isContentLocale(locale) ? locale : 'en-US');
  return (
    <section aria-labelledby="contact-heading" className="mt-9 rounded-xl bg-brand-50 p-7">
      <h2 id="contact-heading" className="m-0 font-display text-2xl font-bold text-brand-950">
        {t('heading')}
      </h2>
      <p className="mt-3 mb-0 font-body text-md text-text">{SUPPORT_EMAIL}</p>
      <p className="mt-5 mb-0">
        <a
          href={href}
          className={`inline-flex min-h-11 items-center justify-center rounded-pill bg-action px-6 font-cta text-md font-extrabold text-text-on-pink no-underline hover:bg-action-hover ${FOCUS_RING}`}
        >
          {t('cta')}
        </a>
      </p>
      <p className="mt-5 mb-0 font-body text-sm text-text-muted">{t('note')}</p>
    </section>
  );
}
