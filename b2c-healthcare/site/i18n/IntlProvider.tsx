'use client';

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import type { ReactNode } from 'react';
import { missingMessageHandlers } from './missing-messages';

/**
 * Client boundary for next-intl. The missing-key handlers are functions, which a Server Component
 * cannot pass as props, so they are attached here.
 */
export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={missingMessageHandlers.onError}
      getMessageFallback={missingMessageHandlers.getMessageFallback}
    >
      {children}
    </NextIntlClientProvider>
  );
}
