import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

/** Body of a route that a later workstream (S to W) replaces. The title comes from the navigation labels. */
export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const t = useTranslations();
  return <PageHeader title={t(titleKey)} subtitle={t('placeholderPage.subtitle')} />;
}
