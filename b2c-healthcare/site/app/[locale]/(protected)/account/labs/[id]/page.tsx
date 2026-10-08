import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LabDetail } from '@/components/account/LabDetail';
import { getLabDetail } from '@/lib/ct/account-labs';
import { requireSessionOrPrompt } from '@/lib/require-session';
import { pageMetadata } from '@/lib/seo';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

type Props = { params: Promise<{ locale: string; id: string }> };

// The title is generic on purpose: a test name is health data and does not belong in the tab title, history or logs.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('account.labs');
  return pageMetadata({ locale, path: '/account/labs', title: t('title'), noindex: true });
}

/**
 * One lab test. An unknown id and another patient's id both end in `notFound()`: the same 404 and the same
 * "Not found." text (`not-found.tsx`), so nothing tells them apart.
 */
export default async function LabDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const gate = await requireSessionOrPrompt('labs', `/account/labs/${encodeURIComponent(id)}`);
  if (!gate.signedIn) return gate.prompt;
  const region = COUNTRY_CONFIG[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE];
  const lab = await getLabDetail(gate.customerId, id, { locale, currency: region.currency, country: region.country });
  if (!lab) notFound();
  return <LabDetail lab={lab} />;
}
