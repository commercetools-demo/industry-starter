/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import Link from 'next/link';
import messages from '@/messages/en-US.json';

// Reached for unknown paths and unsupported locales. It renders its own document because the root layout does not.
export default function NotFound() {
  return (
    <html lang="en-US">
      <body>
        <main>
          <h1>{messages.notFound.title}</h1>
          <p>{messages.notFound.body}</p>
          <Link href="/">{messages.notFound.home}</Link>
        </main>
      </body>
    </html>
  );
}
