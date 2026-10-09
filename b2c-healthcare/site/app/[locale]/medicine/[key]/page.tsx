import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MedicineGallery, MedicineSummary } from '@/components/medicine/MedicineDetailView';
import { Link } from '@/i18n/routing';
import { getMedicineByKeyCached } from '@/lib/ct/medicines';
import { pageMetadata } from '@/lib/seo';
import { getSession } from '@/lib/session';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

type Params = Promise<{ locale: string; key: string }>;

/** Price context of the visitor: the session's currency and country, else the locale's defaults. Nothing else of the session is read. */
async function priceContext(locale: string) {
  const session = await getSession();
  const region = COUNTRY_CONFIG[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE];
  return { currency: session.currency ?? region.currency, country: session.country ?? region.country };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, key } = await params;
  const { currency, country } = await priceContext(locale);
  const medicine = await getMedicineByKeyCached(key, locale, currency, country).catch(() => null);
  if (!medicine) return {};
  const t = await getTranslations({ locale, namespace: 'medicine' });
  return pageMetadata({
    locale,
    path: `/medicine/${key}`,
    title: t('metaTitle', { name: medicine.name }),
    description: t('metaDescription', {
      name: medicine.name,
      strength: medicine.strength,
      form: medicine.dosageForm.toLowerCase(),
      rx: medicine.rxOnly ? t('rxOnly') : t('otc'),
    }),
  });
}

/**
 * Medicine detail page (follow-up AB, D-037). Public catalog data only: no patient data is read, so nothing here depends on who
 * is looking beyond their region. The read is shared with `generateMetadata`; an unknown key is a real 404 (`not-found.tsx`).
 */
export default async function MedicinePage({ params }: { params: Params }) {
  const { locale, key } = await params;
  setRequestLocale(locale);
  const { currency, country } = await priceContext(locale);
  const medicine = await getMedicineByKeyCached(key, locale, currency, country);
  if (!medicine) notFound();
  const t = await getTranslations('medicine');
  return (
    <div className="mx-auto max-w-content px-5 py-6 nav:px-8">
      <nav aria-label={t('back')} className="mb-5 font-meta text-sm">
        <Link href="/search" className="text-brand-700 hover:text-brand-800">
          {t('back')}
        </Link>
      </nav>
      <div className="grid items-start gap-6 nav:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <MedicineGallery medicine={medicine} />
        <MedicineSummary medicine={medicine} />
      </div>
    </div>
  );
}
