import { IntlErrorCode, type IntlError } from 'next-intl';
import defaultMessages from '@/messages/en-US.json';

type Messages = Record<string, unknown>;

export interface MissingMessageHandlers {
  onError: (error: IntlError) => void;
  getMessageFallback: (info: { namespace?: string; key: string; error: IntlError }) => string;
}

function lookup(messages: Messages, path: string): string | undefined {
  let node: unknown = messages;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Messages)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Missing-key behaviour (storefront-locale-routing: Messages and document language).
 * Development: log the key and render it, so gaps are visible.
 * Production: show the default-locale text (never the raw key) and do not log.
 */
export function createMissingMessageHandlers(
  isDevelopment: boolean,
  fallbackMessages: Messages = defaultMessages,
  log: (message: string) => void = (message) => console.error(message),
): MissingMessageHandlers {
  return {
    onError(error) {
      if (isDevelopment || error.code !== IntlErrorCode.MISSING_MESSAGE) log(`[i18n] ${error.message}`);
    },
    getMessageFallback({ namespace, key }) {
      const path = [namespace, key].filter(Boolean).join('.');
      if (isDevelopment) return path;
      return lookup(fallbackMessages, path) ?? '';
    },
  };
}

export const missingMessageHandlers = createMissingMessageHandlers(process.env.NODE_ENV !== 'production');

/** Deep-merges `override` over `base`; used to put default-locale text under the active catalog. */
export function mergeMessages(base: Messages, override: Messages): Messages {
  const result: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] =
      typeof value === 'object' && value !== null && typeof current === 'object' && current !== null
        ? mergeMessages(current as Messages, value as Messages)
        : value;
  }
  return result;
}
