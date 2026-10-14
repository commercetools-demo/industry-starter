// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// A link from block props: a relative path stays inside the store and the locale (`/parts` becomes `/{locale}/{store}/parts`),
// an absolute http(s) URL opens as a plain anchor. The schema has already dropped any other scheme; this re-checks.
import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { isSafeUrl } from '@/lib/puck/automotive-blocks.schema';

export function storePath(href: string, store: string): string {
  return href === `/${store}` || href.startsWith(`/${store}/`) ? href : `/${store}${href}`;
}

export function BlockLink({ href, store, className, children }: { href: string; store: string; className?: string; children: ReactNode }) {
  if (!isSafeUrl(href)) return null;
  if (href.startsWith('/')) {
    return (
      <Link href={storePath(href, store)} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} rel="noopener noreferrer">
      {children}
    </a>
  );
}
