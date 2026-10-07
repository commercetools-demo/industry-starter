import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/** "Make it yours with add-ons" under the plan listings (design/specs/plp.md). Nothing when there is nothing to name or link to. */
export function UpsellBand({ names, href }: { names: string[]; href: string | null }): ReactElement | null {
  const t = useTranslations('plp.upsell');
  const locale = useLocale();
  if (names.length === 0 || href === null) return null;
  return (
    <section aria-labelledby="upsell-title" className="flex flex-col items-start gap-5 rounded-xl bg-pink-50 p-8 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 id="upsell-title" className="m-0 font-display text-2xl font-bold">
          {t('title')}
        </h2>
        <p className="m-0 mt-2 text-md">{t('body', { names: new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names) })}</p>
      </div>
      <Button href={href} variant="secondary">
        {t('cta')}
      </Button>
    </section>
  );
}
