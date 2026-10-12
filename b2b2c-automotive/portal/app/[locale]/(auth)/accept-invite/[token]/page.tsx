import { setRequestLocale } from 'next-intl/server';
import { AcceptInviteForm } from '@/components/auth/AcceptInviteForm';

// Accept an invitation (workstream U-09): public page, the token is the one-time secret from the invitation link.
export default async function AcceptInvitePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  return <AcceptInviteForm token={token} />;
}
