import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { parseMarkdown, type Inline } from '@/lib/markdown';

function renderInline(parts: readonly Inline[]): ReactNode[] {
  return parts.map((part, index) => {
    const text = part.bold ? <strong key={index}>{part.text}</strong> : part.text;
    if (!part.href) return part.bold ? text : <span key={index}>{part.text}</span>;
    const className = 'text-text-link underline hover:text-brand-800';
    return part.href.startsWith('/') ? (
      <Link key={index} href={part.href} className={className}>
        {text}
      </Link>
    ) : (
      <a key={index} href={part.href} className={className}>
        {text}
      </a>
    );
  });
}

export interface MarkdownProps {
  source: string;
  /** Prefix for heading ids so several documents on one page cannot collide. */
  idPrefix?: string;
}

/** Renders the Markdown subset of lib/markdown.ts; React escapes all text. `##` becomes h2, `###` h3. */
export function Markdown({ source, idPrefix = '' }: MarkdownProps) {
  return (
    <div className="grid max-w-180 gap-3 leading-relaxed text-neutral-600">
      {parseMarkdown(source).map((block, index) => {
        if (block.type === 'h2' || block.type === 'h3') {
          const Tag = block.type;
          return (
            <Tag
              key={index}
              id={`${idPrefix}${block.id}`}
              className={`scroll-mt-24 font-display font-semibold text-navy-900 ${block.type === 'h2' ? 'mt-4 text-xl' : 'mt-2 text-lg'}`}
            >
              {block.text}
            </Tag>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={index} className="m-0 grid list-disc gap-1.5 pl-6">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return block.type === 'p' ? (
          <p key={index} className="m-0">
            {renderInline(block.inline)}
          </p>
        ) : null;
      })}
    </div>
  );
}
