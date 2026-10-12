import { setRequestLocale } from 'next-intl/server';
import { PendingApproval } from '@/components/auth/PendingApproval';
import { redirect } from '@/i18n/routing';
import { getPorts } from '@/lib/portal/seam';
import { getPortalSession } from '@/lib/portal/viewer';

// Status page of a registered business that is not active yet. Operators activate the unit and add its store in the
// Merchant Center (manual item OA-11). Nothing is polled.
export default async function PendingApprovalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getPortalSession();
  if (!session.customerId) redirect({ href: '/sign-in', locale });
  if (!session.pending) redirect({ href: '/', locale });
  const businessName = await getPorts().pendingBusinessName(session).catch(() => undefined);
  return <PendingApproval businessName={businessName} />;
}
