import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';

export interface ContentNotesProps {
  draft?: boolean;
  /** Default-language text is shown because the visitor's language has none. */
  fellBack?: boolean;
}

/** "Draft" badge (placeholder copy) and the fallback-language notice; renders nothing when neither applies. */
export function ContentNotes({ draft, fellBack }: ContentNotesProps) {
  const t = useTranslations('content');
  if (!draft && !fellBack) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
      {draft ? (
        <>
          <Badge variant="wait">{t('draft')}</Badge>
          <span>{t('draftNotice')}</span>
        </>
      ) : null}
      {fellBack ? <p className="m-0 w-full">{t('fallbackNotice')}</p> : null}
    </div>
  );
}
