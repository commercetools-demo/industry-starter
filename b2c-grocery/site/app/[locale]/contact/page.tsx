import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactForm } from '@/components/contact/ContactForm';
import { Container } from '@/components/layout/Container';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'static.contact' });
  return { title: t('title'), description: t('intro') };
}

export default async function ContactPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'static.contact' });
  return (
    <Container className="pt-[35px] pb-(--space-8)">
      <p className="mb-(--space-1) text-[12px] tracking-[0.1em] text-accent-700 uppercase">{t('kicker')}</p>
      <h1 className="m-0 mb-(--space-4) text-[40px] leading-[1.05] tablet:text-[56px]">{t('title')}</h1>
      <p className="mb-(--space-6) max-w-[720px] text-[16px] leading-[1.75]">{t('intro')}</p>
      <ContactForm />
    </Container>
  );
}
