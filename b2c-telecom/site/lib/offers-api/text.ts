/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { createTranslator } from 'next-intl';
import deDE from '@/messages/de-DE.json';
import enUS from '@/messages/en-US.json';
import type { Locale, Reason } from '@/lib/types';

/** The text of a rule reason in the buyer's language (`offers.reason.<CODE>`), the same messages the cards use. */
export function reasonTextFor(locale: Locale): (reason: Reason) => string {
  const t = createTranslator({ locale, messages: locale === 'de-DE' ? deDE : enUS, namespace: 'offers.reason' });
  return (reason) => {
    try {
      return t(reason.code as never, reason.params as never);
    } catch {
      return reason.code;
    }
  };
}
