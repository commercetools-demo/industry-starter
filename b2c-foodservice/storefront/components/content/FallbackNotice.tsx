import { useTranslations } from 'next-intl';

/** Shown when a page or article has no text in the requested locale. The fallback region carries lang="en". */
export default function FallbackNotice({ locale }: { locale: string }) {
  const t = useTranslations('content');
  const language = new Intl.DisplayNames([locale], { type: 'language', languageDisplay: 'standard' }).of(locale) ?? locale;
  return (
    <p role="note" className="mb-6 rounded-card border border-line bg-canvas-2 px-4 py-3 text-[14px] text-ink-2">
      {t('fallbackNotice', { language })}
    </p>
  );
}
