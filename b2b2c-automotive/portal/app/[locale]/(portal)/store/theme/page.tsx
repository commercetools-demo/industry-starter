import { setRequestLocale } from 'next-intl/server';
import { ThemeTabServer } from '@/components/store/ThemeTabServer';
import { titleOf } from '@/lib/portal/page-title';

// Tab "Theme" (workstream U-06). The ThemeManager mounts its own router below this path, so the deep paths are served by the
// catch-all next to this file (Next does not allow `page.tsx` and an optional catch-all in one folder, hence both files).
export default async function ThemePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ThemeTabServer locale={locale} />;
}

export const generateMetadata = titleOf(['store.tabs', 'theme'], ['nav.items', 'store']);
