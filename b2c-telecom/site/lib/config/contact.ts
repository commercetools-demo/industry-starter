import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import type { ContentLocale } from '@/lib/content/types';

/** Placeholder mailbox for the demo store; the owner replaces it in SO-09 (D-034: contact is a mailto link only). */
export const SUPPORT_EMAIL = 'support@malva.example';

const SUBJECT: Record<ContentLocale, string> = {
  'en-US': en.content.contact.subject,
  'de-DE': de.content.contact.subject,
};

/** `mailto:` with a localized subject only: no body, no referrer, no account identifier. */
export function supportMailto(locale: ContentLocale): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUBJECT[locale])}`;
}
