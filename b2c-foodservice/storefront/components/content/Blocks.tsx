import { Link } from '@/i18n/routing';
import { renderTokens, type Block, type ContentFigures } from '@/lib/content/blocks';
import { buttonClasses } from '@/components/ui/Button';

const LINK = 'underline underline-offset-2 hover:text-accent';

function Cta({ text, href }: { text: string; href: string }) {
  if (/^https:\/\//.test(href)) {
    return (
      <a href={href} rel="noopener noreferrer" className={buttonClasses({ variant: 'ink' })}>
        {text}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClasses({ variant: 'ink' })}>
      {text}
    </Link>
  );
}

/** Renders structured blocks to semantic elements. Text only: there is no raw HTML path. */
export default function Blocks({ blocks, figures }: { blocks: Block[]; figures: Partial<ContentFigures> }) {
  const t = (text: string) => renderTokens(text, figures);
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h2':
            return (
              <h2 key={i} id={block.id} className="section-title mb-4 mt-12 scroll-mt-28 text-[26px]!">
                {t(block.text)}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={i} className="mb-2 mt-8 font-display text-[18px] font-semibold">
                {t(block.text)}
              </h3>
            );
          case 'p':
            return (
              <p key={i} className="my-4 text-ink-2">
                {t(block.text)}
              </p>
            );
          case 'ul':
            return (
              <ul key={i} className="my-4 list-disc space-y-2 pl-6 text-ink-2">
                {block.items.map((item, j) => (
                  <li key={j}>{t(item)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="my-4 list-decimal space-y-2 pl-6 text-ink-2">
                {block.items.map((item, j) => (
                  <li key={j}>{t(item)}</li>
                ))}
              </ol>
            );
          case 'note':
            return (
              <p key={i} className="my-6 rounded-card border border-line bg-canvas-2 p-4 text-[14px] text-ink-2">
                {t(block.text)}
              </p>
            );
          case 'cta':
            return (
              <p key={i} className="my-6">
                <Cta text={t(block.text)} href={block.href} />
              </p>
            );
        }
      })}
    </>
  );
}

export { LINK as PROSE_LINK };
