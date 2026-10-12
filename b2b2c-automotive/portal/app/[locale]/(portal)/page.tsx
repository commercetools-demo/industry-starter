import { setRequestLocale } from 'next-intl/server';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { getDashboardPorts } from '@/lib/ct/seller/dashboard/ports';
import { getLocalizedString } from '@/lib/utils';
import { getViewer, viewerCan } from '@/lib/portal/viewer';

/**
 * Dashboard (workstream S): the greeting and subtitle are rendered here on the server (Europe/Berlin clock, so server and browser
 * agree); every widget loads on its own in the client (`components/dashboard/Dashboard.tsx`). The subtitle's region and currency
 * come from the store; if that read fails the page still renders, with the store name only.
 */
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('dashboard.view'))) return <Forbidden />;
  const viewer = await getViewer();
  if (!viewer) return <Forbidden />;
  const header = await getDashboardPorts()
    .storeHeader(viewer.storeKey)
    .catch(() => null);
  return (
    <>
      <DashboardHeader
        now={new Date()}
        name={viewer.name.split(' ')[0] ?? viewer.name}
        store={header ? getLocalizedString(header.name, locale) || viewer.storeName : viewer.storeName}
        region={header?.region ?? ''}
        currency={header?.currency ?? ''}
      />
      <Dashboard performanceEnabled={process.env.PORTAL_STORE_PERFORMANCE !== 'off'} />
    </>
  );
}
