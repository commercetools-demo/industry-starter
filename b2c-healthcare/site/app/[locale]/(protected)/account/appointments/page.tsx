import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppointmentList } from '@/components/account/AppointmentList';
import { listAppointments } from '@/lib/ct/account-appointments';
import { requireSessionOrPrompt } from '@/lib/require-session';
import { pageMetadata } from '@/lib/seo';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('account.appointments');
  return pageMetadata({ locale, path: '/account/appointments', title: t('title'), noindex: true });
}

/** The signed-in patient's bookings, per request. The booking's reason is never read for this page. */
export default async function AppointmentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireSessionOrPrompt('account', '/account/appointments');
  if (!gate.signedIn) return gate.prompt;
  const region = COUNTRY_CONFIG[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE];
  const appointments = await listAppointments(gate.customerId, new Date(), { locale, currency: region.currency, country: region.country }).catch(() => null);
  return <AppointmentList appointments={appointments} />;
}
