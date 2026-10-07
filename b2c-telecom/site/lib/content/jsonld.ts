import type { Faq } from './faq';

/** JSON for a `<script type="application/ld+json">`: `<` is escaped so text containing `</script>` cannot end the tag. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** schema.org FAQPage: every question with its plain-text answer. */
export function faqJsonLd(faq: Faq): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.topics.flatMap((topic) =>
      topic.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answerText },
      })),
    ),
  };
}
