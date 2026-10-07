/** JSON for a `<script type="application/ld+json">`: `<` is escaped so text containing `</script>` cannot end the tag. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
