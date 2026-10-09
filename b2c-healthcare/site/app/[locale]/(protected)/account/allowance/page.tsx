import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AllowancePanel } from '@/components/account/AllowancePanel';
import { getAllowanceView } from '@/lib/ct/allowance';
import { getPatient } from '@/lib/ct/patient';
import { requireSessionOrPrompt } from '@/lib/require-session';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('allowance');
  return pageMetadata({ locale, path: '/account/allowance', title: t('title'), noindex: true });
}

/**
 * The member's benefit allowance: balance, what lapses and when. Read fresh on every request (the balance changes with
 * every order). A member without an allowance sees that; a failed read is an error, not a zero balance.
 */
export default async function AllowancePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireSessionOrPrompt('account', '/account/allowance');
  if (!gate.signedIn) return gate.prompt;
  const view = await getPatient(gate.customerId)
    .then((patient) => (patient ? getAllowanceView(patient.patientRef) : null))
    .catch(() => undefined);
  return <AllowancePanel view={view} />;
}
