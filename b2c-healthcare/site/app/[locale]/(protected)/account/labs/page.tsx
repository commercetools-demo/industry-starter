import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LabList } from '@/components/account/LabList';
import { listLabs } from '@/lib/ct/account-labs';
import { requireSessionOrPrompt } from '@/lib/require-session';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('account.labs');
  return pageMetadata({ locale, path: '/account/labs', title: t('title'), noindex: true });
}

/** Lab tests of the signed-in patient. Names, dates and status only: no values on the list. */
export default async function LabsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireSessionOrPrompt('labs', '/account/labs');
  if (!gate.signedIn) return gate.prompt;
  const labs = await listLabs(gate.customerId).catch(() => null);
  return <LabList labs={labs} />;
}
