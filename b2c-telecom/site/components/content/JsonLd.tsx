import type { ReactElement } from 'react';
import { serializeJsonLd } from '@/lib/content/jsonld';

/** Structured data for search engines; the data comes from repo-authored content only. */
export function JsonLd({ data }: { data: unknown }): ReactElement {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
