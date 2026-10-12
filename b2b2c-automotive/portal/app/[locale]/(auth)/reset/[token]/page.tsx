import { setRequestLocale } from 'next-intl/server';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { isOnscreenResetEnabled } from '@/lib/portal/flags';

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  return <ResetPasswordForm token={token} enabled={isOnscreenResetEnabled()} />;
}
