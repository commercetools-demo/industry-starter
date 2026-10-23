import { safeJsonLd } from '@/lib/seo/json-ld';

/** Structured data. The one place that injects a string into a script tag; `safeJsonLd` escapes `<` so the JSON cannot close it. */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />;
}
