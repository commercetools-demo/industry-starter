import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProfileAbout, ProfileHeader, ProfileReviews } from '@/components/doctors/DoctorProfile';
import { Link } from '@/i18n/routing';
import { getDoctorByKeyCached } from '@/lib/ct/doctors';
import { backToList, isConsultationMode } from '@/lib/doctor-back';
import { getSession } from '@/lib/session';
import type { ConsultationMode } from '@/lib/types';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

type Params = Promise<{ locale: string; key: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

/** Price context of the visitor: the session's currency and country, else the locale's defaults. */
async function priceContext(locale: string) {
  const session = await getSession();
  const region = COUNTRY_CONFIG[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE];
  return { currency: session.currency ?? region.currency, country: session.country ?? region.country, session };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, key } = await params;
  const { currency, country } = await priceContext(locale);
  const doctor = await getDoctorByKeyCached(key, locale, currency, country).catch(() => null);
  if (!doctor) return {};
  const t = await getTranslations({ locale, namespace: 'doctor' });
  return {
    title: t('metaTitle', { name: doctor.name, specialty: doctor.specialty }),
    description: t('metaDescription', { name: doctor.name, specialty: doctor.specialty, years: doctor.yearsExperience }),
  };
}

/**
 * Doctor profile (design-pdp). The product read is shared with `generateMetadata` (one call per request); an
 * unknown key is a real 404 (`not-found.tsx`). The booking panel is added next to the content (workstream L-04).
 */
export default async function DoctorPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, key } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const { currency, country } = await priceContext(locale);
  const doctor = await getDoctorByKeyCached(key, locale, currency, country);
  if (!doctor) notFound();
  const t = await getTranslations('doctor');

  const asked = first(query.m);
  const requested: ConsultationMode | undefined = isConsultationMode(asked) ? asked : undefined;
  const mode: ConsultationMode = requested && doctor.modes.includes(requested) ? requested : (doctor.modes[0] ?? requested ?? 'remote');
  const back = backToList(first(query.back), mode);

  return (
    <div className="mx-auto max-w-content px-5 py-6 nav:px-8">
      <nav aria-label={t('back')} className="mb-5 font-meta text-sm">
        <Link href={back} className="text-brand-700 hover:text-brand-800">
          {t('back')}
        </Link>
      </nav>
      <div className="grid items-start gap-6 nav:grid-cols-[1fr_380px]">
        <div className="grid gap-6">
          <ProfileHeader doctor={doctor} />
          <ProfileAbout doctor={doctor} />
          <ProfileReviews reviews={doctor.reviews} />
        </div>
        <aside data-testid="booking-column" />
      </div>
    </div>
  );
}
