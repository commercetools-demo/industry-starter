const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * Serialises structured data for a `<script type="application/ld+json">`. `<` is escaped so a value such as a product name or
 * review text containing `</script>` cannot close the tag, and the two line separators that older parsers treat as line ends.
 * The only way JSON-LD enters the page (workstream Q, S9).
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .split(LINE_SEPARATOR).join('\\u2028')
    .split(PARAGRAPH_SEPARATOR).join('\\u2029');
}
