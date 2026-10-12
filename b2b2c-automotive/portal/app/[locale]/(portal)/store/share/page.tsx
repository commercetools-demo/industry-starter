import { setRequestLocale } from 'next-intl/server';
import { SharePanel } from '@/components/store/SharePanel';
import { storefrontOrigin } from '@/lib/portal/storefront-origin';

// Tab "Share": attributed links with QR codes (workstream U-05). The origin is read on the server and passed as a prop.
export default async function SharePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SharePanel origin={storefrontOrigin()} />;
}
