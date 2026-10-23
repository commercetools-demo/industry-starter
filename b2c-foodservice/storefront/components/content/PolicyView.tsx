import Blocks from '@/components/content/Blocks';
import ContentPage from '@/components/content/ContentPage';
import DraftBanner from '@/components/content/DraftBanner';
import EffectiveDate from '@/components/content/EffectiveDate';
import FallbackNotice from '@/components/content/FallbackNotice';
import { POLICIES } from '@/content/policies';
import { headingsOf, type ContentFigures } from '@/lib/content/blocks';
import { resolveLocalized } from '@/lib/content/localized';
import type { PolicySlug } from '@/lib/routes';

/** One policy page. Plain content: no session, cart or commerce dependency beyond the token figures passed in. */
export default function PolicyView({
  slug,
  locale,
  figures,
  policies = POLICIES,
}: {
  slug: PolicySlug;
  locale: string;
  figures: ContentFigures;
  policies?: typeof POLICIES;
}) {
  const { value: policy, isFallback } = resolveLocalized(policies[slug], locale);
  return (
    <ContentPage
      title={policy.title}
      toc={headingsOf(policy.body)}
      contentLang={isFallback ? 'en' : undefined}
      banners={
        <>
          {isFallback ? <FallbackNotice locale={locale} /> : null}
          {policy.isDraft ? <DraftBanner /> : null}
          <EffectiveDate date={policy.effectiveDate} locale={locale} />
        </>
      }
    >
      <Blocks blocks={policy.body} figures={figures} />
    </ContentPage>
  );
}
