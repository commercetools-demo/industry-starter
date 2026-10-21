/** Structured data. The one place in the content pages that injects a string into a script tag; `<` is escaped so the JSON cannot close it. */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
