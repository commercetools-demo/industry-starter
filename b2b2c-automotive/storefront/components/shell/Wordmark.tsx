// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import type { StoreSettings } from '@/lib/types';

/** The store's logo (`alt` is the store name) or, without a logo, a text wordmark. Links to the store home. */
export function Wordmark({ store, settings }: { store: string; settings: StoreSettings }) {
  return (
    <Link href={`/${store}`} className="inline-flex min-h-7 max-w-full items-center">
      {settings.logoUrl ? (
        // The logo URL is seller data from any host: served as is (no image optimizer host allow-list).
        <Image src={settings.logoUrl} alt={settings.name} width={160} height={40} unoptimized className="h-6 w-auto" />
      ) : (
        <span className="truncate font-display text-lg font-bold text-brand-700 md:text-xl">{settings.name}</span>
      )}
    </Link>
  );
}
