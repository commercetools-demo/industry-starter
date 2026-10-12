import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EmailPage, type EmailTab } from '@/components/email/EmailPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { Forbidden } from '@/components/portal/Forbidden';
import { viewerCan } from '@/lib/portal/viewer';

// Email (workstream W): templates and campaigns by audience rule. They are stored and previewed only; nothing is ever sent (Q-P01).
export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewerCan('email.manage'))) return <Forbidden />;
  const { tab } = await searchParams;
  const [tNav, t] = await Promise.all([getTranslations('nav.items'), getTranslations('email')]);
  const initialTab: EmailTab = tab === 'campaigns' ? 'campaigns' : 'templates';
  return (
    <div className="flex flex-col gap-400">
      <PageHeader title={tNav('email')} subtitle={t('subtitle')} />
      <EmailPage initialTab={initialTab} />
    </div>
  );
}
