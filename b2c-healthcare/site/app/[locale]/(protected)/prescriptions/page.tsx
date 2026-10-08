import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RxLookup } from '@/components/prescriptions/RxLookup';
import { getPatient } from '@/lib/ct/patient';
import { listOwnPrescriptions } from '@/lib/ct/prescriptions';
import { getSession } from '@/lib/session';
import type { RxQuickPick } from '@/lib/types';

type Params = Promise<{ locale: string }>;

// Patient data: never indexed. (The sign-in prompt for a visitor without a session comes from the (protected) layout.)
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'rx' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/** The patient's own prescriptions are offered as quick-picks; a failure to read them only hides the shortcuts. */
async function quickPicksFor(customerId: string | undefined): Promise<RxQuickPick[]> {
  if (!customerId) return [];
  try {
    const patient = await getPatient(customerId);
    return patient ? await listOwnPrescriptions(patient.patientRef) : [];
  } catch {
    return [];
  }
}

export default async function PrescriptionsPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  return <RxLookup quickPicks={await quickPicksFor(session.customerId)} />;
}
