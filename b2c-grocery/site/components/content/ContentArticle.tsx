import type { ContentPage } from '@/lib/content';
import { Container } from '@/components/layout/Container';

/** Markdown body in the Organic reading style: 16px/1.75, 78% text, 720px column. The HTML comes from repo-authored files. */
export function Prose({ html }: { html: string }) {
  return (
    <div
      className="max-w-[720px] text-[16px] leading-[1.75] text-[color-mix(in_srgb,var(--color-text)_78%,transparent)] [&_h2]:mt-(--space-6) [&_h2]:mb-(--space-2) [&_h3]:mt-(--space-4) [&_p]:my-(--space-3) [&_ul]:pl-(--space-4)"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Static page shell: kicker, H1 and the markdown body. Server Component. */
export function ContentArticle({ page }: { page: ContentPage }) {
  return (
    <Container className="pt-[35px] pb-(--space-8)">
      {page.kicker ? <p className="mb-(--space-1) text-[12px] tracking-[0.1em] text-accent-700 uppercase">{page.kicker}</p> : null}
      <h1 className="m-0 mb-(--space-6) text-[40px] leading-[1.05] tablet:text-[56px]">{page.title}</h1>
      <Prose html={page.html} />
    </Container>
  );
}
