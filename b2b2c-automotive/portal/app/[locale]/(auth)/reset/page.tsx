import { setRequestLocale } from 'next-intl/server';
import { ResetRequestForm } from '@/components/auth/ResetRequestForm';
import { isOnscreenResetEnabled } from '@/lib/portal/flags';

export default async function ResetRequestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // With DEMO_ONSCREEN_RESET off the page shows no reset form (the routes answer 404 as well).
  return <ResetRequestForm enabled={isOnscreenResetEnabled()} />;
}
