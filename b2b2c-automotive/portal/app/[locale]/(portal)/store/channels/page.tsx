import { setRequestLocale } from 'next-intl/server';
import { ChannelsTable } from '@/components/store/ChannelsTable';
import { titleOf } from '@/lib/portal/page-title';

// Tab "Channels": orders by sales channel over the last 30 days (workstream U-05).
export default async function ChannelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ChannelsTable />;
}

export const generateMetadata = titleOf(['store.tabs', 'channels'], ['nav.items', 'store']);
