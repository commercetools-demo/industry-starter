import { redirect } from '@/i18n/routing';

// Account settings (workstream U): the first tab is the landing page. The layout gates the role.
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/account/general', locale });
}
