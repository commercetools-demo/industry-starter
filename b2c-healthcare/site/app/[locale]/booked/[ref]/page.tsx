import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookingConfirmation } from '@/components/booking/BookingConfirmation';
import { getBookingForVisitor } from '@/lib/booking-access';
import { getBookingPatient } from '@/lib/ct/booking-patient';
import { getDoctorByKey } from '@/lib/ct/doctors';
import { mapBookingView } from '@/lib/mappers/booking';
import { getSession } from '@/lib/session';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

type Params = Promise<{ locale: string; ref: string }>;

// A booking page is personal: it is never indexed.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'booking.confirmed' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/**
 * Booking confirmation (design-pdp). Only the booking's own session sees it: the signed-in patient who owns it, or
 * the browser that created it as a guest (signed `malva_bk` cookie). Anyone else, and an unknown or expired
 * reference, gets the same plain not-found (`not-found.tsx`), so nothing tells them apart.
 */
export default async function BookedPage({ params }: { params: Params }) {
  const { locale, ref } = await params;
  setRequestLocale(locale);
  const booking = await getBookingForVisitor(ref);
  if (!booking) notFound();

  const session = await getSession();
  const region = COUNTRY_CONFIG[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE];
  const [doctor, patient] = await Promise.all([
    getDoctorByKey(booking.doctorKey, { locale, currency: session.currency ?? region.currency, country: session.country ?? region.country }, { reviews: false }).catch(() => null),
    booking.patientRef && session.customerId ? getBookingPatient(session.customerId).catch(() => null) : Promise.resolve(null),
  ]);
  return <BookingConfirmation booking={mapBookingView(booking, doctor, patient?.firstName)} signedIn={Boolean(session.customerId)} />;
}
