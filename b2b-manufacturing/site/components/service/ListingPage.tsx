import { SlotImage } from '@/components/ui/SlotImage';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { CheckList, CtaBand, PageHeader } from '@/components/ui/content';
import { LinkButton } from '@/components/ui/Button';
import type { Service } from '@/lib/types';
import { ROUTES } from '@/lib/site';
import { absoluteUrl, alternateLanguages, pageMetadata } from '@/lib/seo';
import { CATEGORY_MESSAGE_KEY, type ServiceCategory } from './constants';
import { SectorFilter } from './SectorFilter';
import { ServiceGrid } from './ServiceGrid';
import './service.css';

/** Public canonical for a locale and path, plus the hreflang alternates. Absolute so crawlers resolve them. */
export function alternatesFor(locale: string, path: string): Metadata['alternates'] {
  return { canonical: absoluteUrl(locale, path), languages: alternateLanguages(path) };
}

export async function listingMetadata(category: ServiceCategory, locale: string): Promise<Metadata> {
  const t = await getTranslations({ namespace: 'listing', locale });
  const key = CATEGORY_MESSAGE_KEY[category];
  return pageMetadata({ locale, title: t(`${key}.metaTitle`), description: t(`${key}.metaDescription`), path: `/${category}` });
}

/** A listing, optionally narrowed to one sector. Receives the category's services from the route (components never import lib/ct). Public data only; never reads the session. */
export async function ListingPage({ category, locale, sector, services: all }: { category: ServiceCategory; locale: string; sector?: string; services: Service[] }) {
  const t = await getTranslations({ namespace: 'listing', locale });
  const key = CATEGORY_MESSAGE_KEY[category];
  const active = sector || undefined;
  const shown = active ? all.filter((s) => s.sectors.includes(active)) : all;
  const quoteHref = ROUTES.quote;
  return (
    <>
      <PageHeader breadcrumb={{ homeLabel: t('breadcrumbHome'), current: t(`${key}.crumb`) }} title={t(`${key}.title`)} lead={t(`${key}.lead`)} />
      <section className="s"><div className="wrap">
        <h2 className="sr-only">{t('gridHeading')}</h2>
        {all.length === 0 ? (
          <div className="empty-state" data-testid="empty-category">
            <p>{t('emptyBody')}</p>
            <LinkButton href={quoteHref}>{t('requestQuote')}</LinkButton>
          </div>
        ) : (
          <>
            <SectorFilter category={category} active={active} services={all} />
            {shown.length === 0 ? (
              <div className="empty-state" data-testid="no-match">
                <h2 style={{ font: '600 24px/1.3 var(--font-display)' }}>{t('noMatchTitle')}</h2>
                <p>{t('noMatchBody')}</p>
                <div className="row">
                  <LinkButton variant="outline" href={`/${category}`}>{t('clearFilter')}</LinkButton>
                  <LinkButton href={quoteHref}>{t('requestQuote')}</LinkButton>
                </div>
              </div>
            ) : <ServiceGrid services={shown} />}
          </>
        )}
      </div></section>
      {category === 'plumbing' ? (
        <section className="s g"><div className="wrap grid g2" style={{ alignItems: 'center', gap: 64 }}>
          <SlotImage slot="cctv-survey" />
          <div>
            <h2 style={{ font: '600 32px/1.2 var(--font-display)', marginBottom: 24 }}>{t('plumbing.bandTitle')}</h2>
            <CheckList items={[1, 2, 3, 4].map((i) => t(`plumbing.bandItem${i}`))} />
          </div>
        </div></section>
      ) : (
        <section className="s d" data-testid="compliance-band"><div className="wrap">
          <div className="sh"><div><h2>{t('waste.bandTitle')}</h2><p>{t('waste.bandLead')}</p></div></div>
          <div className="grid g2">
            <CheckList items={[1, 2, 3].map((i) => t(`waste.bandLeft${i}`))} />
            <CheckList items={[1, 2, 3].map((i) => t(`waste.bandRight${i}`))} />
          </div>
        </div></section>
      )}
      <CtaBand title={t(`${key}.ctaTitle`)} cta={t('requestQuote')} href={quoteHref} />
    </>
  );
}
