import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { detailMetadata, ServiceDetail } from '@/components/service/ServiceDetail';
import { routing } from '@/i18n/routing';
import { getAllServices, getRelatedServices, getServiceBySlug } from '@/lib/ct/services';

/** Public and identical for every visitor: static with ISR, never reads the session. */
export const revalidate = 60;

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = [];
  for (const locale of routing.locales) {
    try {
      for (const s of await getAllServices(locale)) if (s.category === 'waste-management') params.push({ locale, slug: s.slug });
    } catch {
      // Catalog unreachable at build time: pages are then generated on first request (ISR).
    }
  }
  return params;
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const service = await getServiceBySlug(slug, locale);
  return service && service.category === 'waste-management' ? detailMetadata(service, locale) : {};
}

export default async function Page({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const service = await getServiceBySlug(slug, locale);
  if (!service || service.category !== 'waste-management') notFound();
  const related = await getRelatedServices(service, locale);
  return <ServiceDetail service={service} locale={locale} category="waste-management" related={related} />;
}
