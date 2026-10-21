import { useTranslations } from 'next-intl';
import ContactForm from '@/components/contact/ContactForm';
import ContentPage from '@/components/content/ContentPage';
import FooterStoreButton from '@/components/layout/FooterStoreButton';
import { buttonClasses } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { CONTACT, channelFor } from '@/content/contact';
import { resolveLocalized } from '@/lib/content/localized';
import { marketForLocale } from '@/lib/utils';

/** Contact page. Static channels per market (`byCountry[country] ?? default`); no commerce call, no third-party script, no chat. */
export default function ContactView({ locale, contact = CONTACT }: { locale: string; contact?: typeof CONTACT }) {
  const t = useTranslations('contact');
  const market = marketForLocale(locale);
  const channel = channelFor(market.country, contact);
  const label = resolveLocalized(channel.label, locale).value;
  const hours = resolveLocalized(channel.hours, locale).value;
  const replyWithin = resolveLocalized(channel.replyWithin, locale).value;

  return (
    <ContentPage title={t('title')} intro={t('intro')} wide>
      <div className="grid gap-6 stack:grid-cols-[1.4fr_1fr]">
        <div className="order-2 stack:order-1">
          <ContactForm locale={locale} channel={{ email: channel.email, phone: channel.phone, replyWithin }} />
        </div>
        <div className="order-1 flex flex-col gap-4 stack:order-2">
          <Card as="section" aria-labelledby="contact-channels">
            <h2 id="contact-channels" className="m-0 mb-3 font-display text-[18px] font-semibold">
              {label === t('channels.title') ? label : `${t('channels.title')}: ${label}`}
            </h2>
            <dl className="m-0 grid gap-3 text-[14px]">
              <div>
                <dt className="eyebrow">{t('channels.email')}</dt>
                <dd className="m-0">
                  <a href={`mailto:${channel.email}`} className="underline underline-offset-2 hover:text-accent">
                    {channel.email}
                  </a>
                </dd>
              </div>
              {channel.phone ? (
                <div>
                  <dt className="eyebrow">{t('channels.phone')}</dt>
                  <dd className="m-0">
                    <a href={`tel:${channel.phone.replace(/[^+\d]/g, '')}`} className="underline underline-offset-2 hover:text-accent">
                      {channel.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="eyebrow">{t('channels.hours')}</dt>
                <dd className="m-0 text-ink-2">{hours}</dd>
              </div>
              <div>
                <dt className="eyebrow">{t('channels.reply')}</dt>
                <dd className="m-0 text-ink-2">{replyWithin}</dd>
              </div>
            </dl>
          </Card>
          {market.collection ? (
            <Card as="section" aria-labelledby="contact-store">
              <h2 id="contact-store" className="m-0 mb-2 font-display text-[18px] font-semibold">
                {t('store.title')}
              </h2>
              <p className="m-0 mb-4 text-[14px] text-ink-2">{t('store.text')}</p>
              <FooterStoreButton label={t('store.button')} className={buttonClasses({ variant: 'ghost' })} />
            </Card>
          ) : null}
        </div>
      </div>
    </ContentPage>
  );
}
