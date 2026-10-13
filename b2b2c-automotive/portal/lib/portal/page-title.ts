// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Page titles (WCAG 2.4.2, workstream Y): every route sets a title in the request locale, most specific part first; the root
// layout's title template appends "Malva Partner Portal". A page that sets `generateMetadata` replaces its layout's title, so a tab
// route repeats its section: "Price overrides · Catalog & pricing".
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/** `[namespace, key]` of a catalogue message, for example `['nav.items', 'returns']`. */
export type TitlePart = readonly [namespace: string, key: string];

export async function titleMetadata(locale: string, ...parts: TitlePart[]): Promise<Metadata> {
  const labels = await Promise.all(parts.map(async ([namespace, key]) => (await getTranslations({ locale, namespace }))(key)));
  return { title: labels.join(' · ') };
}

/** `generateMetadata` for a route whose title is fixed. */
export const titleOf =
  (...parts: TitlePart[]) =>
  async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> =>
    titleMetadata((await params).locale, ...parts);
