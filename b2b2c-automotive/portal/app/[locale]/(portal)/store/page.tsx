import { redirect } from '@/i18n/routing';

// Store & channels opens on its first tab. The layout has already refused a role that may not view the store.
export default async function StorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/store/settings', locale });
}
