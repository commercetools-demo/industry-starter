import { sizedImage, srcSetFor } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { CheckList, CtaBand, Tag } from '@/components/ui/content';
import { LinkButton } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { COMMERCIAL_NUMBER, EMERGENCY_NUMBER, ROUTES } from '@/lib/site';
import type { Service } from '@/lib/types';
import { AddToQuoteList } from './AddToQuoteList';
import { pageMetadata } from '@/lib/seo';
import { CATEGORY_MESSAGE_KEY, type ServiceCategory } from './constants';
import { breadcrumbJsonLd, jsonLdString, serviceJsonLd } from './seo';
import { ServiceTile } from './ServiceTile';
import './service.css';

const tel = (n: string) => `tel:${n.replace(/\s/g, '')}`;

export async function detailMetadata(service: Service, locale: string): Promise<Metadata> {
  const t = await getTranslations({ namespace: 'serviceDetail', locale });
  const title = t('metaTitle', { name: service.name });
  const description = service.summary || t('metaDescriptionFallback', { name: service.name });
  return pageMetadata({ locale, title, description, path: `/${service.category}/${service.slug}`, image: service.imageUrl ? sizedImage(service.imageUrl, 1200) : undefined });
}

export async function ServiceDetail({ service, locale, category, related: relatedAll }: { service: Service; locale: string; category: ServiceCategory; related: Service[] }) {
  const t = await getTranslations({ namespace: 'serviceDetail', locale });
  const tl = await getTranslations({ namespace: 'listing', locale });
  const related = relatedAll.filter((r) => r.id !== service.id).slice(0, 3);
  const categoryLabel = tl(`${CATEGORY_MESSAGE_KEY[category]}.crumb`);
  const sectorLabel = (k: string) => (t.has(`sectors.${k}`) ? t(`sectors.${k}`) : k);
  const quoteHref = { pathname: ROUTES.quote, query: { service: service.slug } };
  const trail = [
    { name: t('breadcrumbHome'), path: '' },
    { name: categoryLabel, path: `/${category}` },
    { name: service.name, path: `/${category}/${service.slug}` },
  ];

  return (
    <div className="pdp-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(serviceJsonLd(service, locale, categoryLabel)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(locale, trail)) }} />
      <div className="phead"><div className="wrap">
        <nav aria-label={t('breadcrumbLabel')} className="crumb">
          <ol>
            <li><Link href="/">{trail[0]!.name}</Link></li>
            <li><Link href={`/${category}`}>{categoryLabel}</Link></li>
            <li><span aria-current="page">{service.name}</span></li>
          </ol>
        </nav>
        <h1>{service.name}</h1>
        {service.summary ? <p>{service.summary}</p> : null}
      </div></div>

      <section className="s"><div className="wrap pdp">
        <aside className="pdp-aside" aria-labelledby="pdp-actions">
          <div className="pdp-card">
            <h2 id="pdp-actions">{t('actionsTitle')}</h2>
            <LinkButton href={quoteHref} data-testid="request-quote-primary">{t('requestThis')}</LinkButton>
            <AddToQuoteList serviceId={service.id} slug={service.slug} frequencies={service.frequencies} />
            <p>{t('response')}</p>
            <p>{t('phoneLabel')} <a className="phone" href={tel(COMMERCIAL_NUMBER)}>{COMMERCIAL_NUMBER}</a></p>
            <small>{t('emergency', { number: EMERGENCY_NUMBER })}</small>
          </div>
        </aside>

        <div className="pdp-main">
          {service.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="pdp-photo" src={sizedImage(service.imageUrl, 1200)} srcSet={srcSetFor(service.imageUrl, [640, 1200])} sizes="(max-width: 900px) 100vw, 780px" alt={t('heroAlt')} />
          ) : <div className="pdp-photo ph" aria-hidden="true" />}
          {service.description && service.description !== service.summary ? <p>{service.description}</p> : null}
          {service.included.length > 0 ? <section id="included" aria-labelledby="h-included"><h2 id="h-included">{t('whatsIncluded')}</h2><CheckList items={service.included} /></section> : null}
          {service.sectors.length > 0 ? <section id="audience" aria-labelledby="h-audience"><h2 id="h-audience">{t('whoFor')}</h2><div className="pdp-tags">{service.sectors.map((k) => <Tag key={k}>{sectorLabel(k)}</Tag>)}</div></section> : null}
          {service.steps.length > 0 ? <section id="how" aria-labelledby="h-how"><h2 id="h-how">{t('howItWorks')}</h2><ol className="pdp-steps">{service.steps.map((s) => <li key={s}><span>{s}</span></li>)}</ol></section> : null}
          {service.records.length > 0 ? <section id="records" aria-labelledby="h-records"><h2 id="h-records">{t('records')}</h2><CheckList items={service.records} /></section> : null}
          {service.faq.length > 0 ? (
            <section id="faq" aria-labelledby="h-faq" className="pdp-faq"><h2 id="h-faq">{t('faq')}</h2>
              {service.faq.map((f) => <details key={f.question}><summary>{f.question}</summary><p>{f.answer}</p></details>)}
            </section>
          ) : null}
        </div>
      </div></section>

      {related.length > 0 ? (
        <section className="s g" aria-labelledby="h-related"><div className="wrap">
          <div className="sh"><div><h2 id="h-related">{t('related')}</h2></div></div>
          <div className="grid g3" data-testid="related-services">
            {related.map((r) => <ServiceTile key={r.id} id={r.id} href={`/${r.category}/${r.slug}`} name={r.name} summary={r.summary} imageUrl={r.imageUrl} more={t('more')} />)}
          </div>
        </div></section>
      ) : null}

      <CtaBand title={t('ctaTitle')} cta={t('ctaButton')} href={ROUTES.quote} />
      <div className="pdp-bar" role="region" aria-label={t('mobileBar')} data-testid="sticky-bar">
        <LinkButton href={quoteHref}>{t('requestThis')}</LinkButton>
      </div>
    </div>
  );
}
