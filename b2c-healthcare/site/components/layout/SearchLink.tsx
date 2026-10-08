import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/**
 * Header search entry (D-017): a magnifier link to the search page, whose form (components/search/SearchForm)
 * works without JavaScript and lands on results scoped to doctors and medicines. Shown from the nav
 * breakpoint up; under it the home hero and the search page carry the form.
 */
export function SearchLink() {
  const t = useTranslations('search');
  return (
    <Link
      href="/search"
      aria-label={t('label')}
      className="grid size-10 place-items-center rounded-md border border-border bg-surface text-navy-900 hover:bg-brand-50 max-nav:hidden"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" />
      </svg>
    </Link>
  );
}
