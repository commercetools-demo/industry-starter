import { useTranslations } from 'next-intl';
import ContentPage from '@/components/content/ContentPage';
import FallbackNotice from '@/components/content/FallbackNotice';
import FooterStoreButton from '@/components/layout/FooterStoreButton';
import Card from '@/components/ui/Card';
import { buttonClasses } from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Icon from '@/components/ui/Icon';
import { ABOUT, type AboutContent } from '@/content/about';
import { resolveLocalized, type Localized } from '@/lib/content/localized';
import { buildListingHref } from '@/lib/nav/listing-href';
import { contactHref } from '@/lib/routes';
import { marketForLocale } from '@/lib/utils';

/** About page body. Static content only: no commerce call, no session. */
export default function AboutView({ locale, content = ABOUT }: { locale: string; content?: Localized<AboutContent> }) {
  const t = useTranslations('about');
  const { value: c, isFallback } = resolveLocalized(content, locale);
  const showStore = marketForLocale(locale).collection;
  return (
    <ContentPage
      title={c.title}
      eyebrow={c.eyebrow}
      intro={c.intro}
      contentLang={isFallback ? 'en' : undefined}
      banners={isFallback ? <FallbackNotice locale={locale} /> : null}
    >
      <section aria-labelledby="about-story" className="mt-4">
        <h2 id="about-story" className="sr-only">
          {c.eyebrow}
        </h2>
        {c.story.map((paragraph) => (
          <p key={paragraph} className="my-4 text-ink-2">
            {paragraph}
          </p>
        ))}
      </section>

      <ul className="m-0 mt-10 grid list-none gap-4 p-0 stack:grid-cols-3">
        {c.values.map((v) => (
          <li key={v.title}>
            <Card as="article" className="h-full">
              <Icon name={v.icon} size={28} className="text-accent" />
              <h2 className="mb-2 mt-3 font-display text-[18px] font-semibold">{v.title}</h2>
              <p className="m-0 text-[14px] text-ink-2">{v.text}</p>
            </Card>
          </li>
        ))}
      </ul>

      <Card as="section" className="mt-6 bg-canvas-2">
        <h2 className="m-0 mb-2 font-display text-[18px] font-semibold">{c.recycling.title}</h2>
        <p className="m-0 text-[14px] text-ink-2">{c.recycling.text}</p>
      </Card>

      {showStore ? (
        <section className="mt-10 rounded-panel border border-line bg-surface p-6">
          <h2 className="m-0 mb-2 font-display text-[22px] font-semibold">{c.store.title}</h2>
          <p className="m-0 mb-4 text-ink-2">{c.store.text}</p>
          <FooterStoreButton label={t('findStore')} className={buttonClasses({ variant: 'ink' })} />
        </section>
      ) : null}

      <section className="mt-10 rounded-panel bg-canvas-2 p-8">
        <h2 className="m-0 mb-2 font-display text-[24px] font-semibold">{c.closing.title}</h2>
        <p className="m-0 mb-5 text-ink-2">{c.closing.text}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={buildListingHref('coffee')} variant="accent">
            {t('shop')}
          </ButtonLink>
          <ButtonLink href={contactHref()} variant="ghost">
            {t('contact')}
          </ButtonLink>
        </div>
      </section>
    </ContentPage>
  );
}
