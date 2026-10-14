import { redirect } from '@/i18n/routing';

// Content opens on its Pages tab. The layout has already refused a role that may not view content.
export default async function ContentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/content/pages', locale });
}
