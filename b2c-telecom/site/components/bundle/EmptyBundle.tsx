import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

export type EmptyBundleLink = { key: 'phone' | 'wireless' | 'cable'; href: string };

/** The empty state: a route back into the catalog (the three categories), never a summary with zero totals. */
export function EmptyBundle({ links }: { links: EmptyBundleLink[] }): ReactElement {
  const t = useTranslations('bundle.empty');
  return (
    <div className="flex flex-col items-center gap-5 rounded-xl border border-border bg-surface p-10 text-center md:p-12">
      <h2 className="m-0 font-display text-3xl font-bold tracking-ui">{t('title')}</h2>
      <p className="m-0 text-md text-text-muted">{t('body')}</p>
      <nav aria-label={t('aria')} className="flex flex-wrap justify-center gap-4">
        {links.map((link) => (
          <Button key={link.key} href={link.href}>
            {t(link.key)}
          </Button>
        ))}
      </nav>
    </div>
  );
}
