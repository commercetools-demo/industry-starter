import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountHeading } from '@/components/account/AccountShell';
import { EnableRefillForm } from '@/components/auto-refill/EnableRefillForm';
import { RefillList } from '@/components/auto-refill/RefillList';
import { getPaymentProvider } from '@/lib/checkout/provider';
import { listRefills } from '@/lib/ct/auto-refill';
import { getPatient } from '@/lib/ct/patient';
import { hasSavedMethod, refillOptions } from '@/lib/ct/refill-options';
import { requireSessionOrPrompt } from '@/lib/require-session';
import { rxContextOf } from '@/lib/rx-route';
import { pageMetadata } from '@/lib/seo';
import { getSession } from '@/lib/session';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('autoRefill');
  return pageMetadata({ locale, path: '/account/auto-refill', title: t('metaTitle'), noindex: true });
}

/**
 * `/account/auto-refill`: the customer's standing refills (pause, resume, skip next, change the schedule, cancel; the
 * last scheduled check and why a run did not happen) and the form to set one up from their own prescriptions. Read by
 * customer id; nobody else's refill can appear. A failed read of one part leaves the other parts working.
 */
export default async function AutoRefillPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireSessionOrPrompt('account', '/account/auto-refill');
  if (!gate.signedIn) return gate.prompt;
  const t = await getTranslations('autoRefill');
  const ctx = rxContextOf(await getSession());
  const patient = await getPatient(gate.customerId).catch(() => null);
  const [refills, options, hasMethod] = await Promise.all([
    listRefills(gate.customerId, locale).catch(() => null),
    patient ? refillOptions(patient, ctx).catch(() => []) : Promise.resolve([]),
    hasSavedMethod(gate.customerId, getPaymentProvider),
  ]);
  return (
    <>
      <AccountHeading title={t('title')} sub={t('sub')} />
      <div className="grid gap-6">
        <RefillList refills={refills} />
        <EnableRefillForm options={options} hasMethod={hasMethod} />
      </div>
    </>
  );
}
