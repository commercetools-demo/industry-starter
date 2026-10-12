// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { CategoryNav } from '@/components/shell/CategoryNav';
import { Footer } from '@/components/shell/Footer';
import { Header } from '@/components/shell/Header';
import { MAIN_ID, SkipLink } from '@/components/shell/SkipLink';
import { GarageRoot } from '@/components/vehicle/GarageRoot';
import { UtilityBar } from '@/components/shell/UtilityBar';
import { StorePickerHost } from '@/components/store-picker/StorePickerHost';
import { getNavCategories } from '@/lib/ct/categories';
import { getShellContext } from '@/lib/ct/shell';
import { getSession } from '@/lib/session';
import { buildBranchesResponse } from '@/lib/store/branches-view';

type Params = Promise<{ locale: string; store: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, store } = await params;
  const ctx = await getShellContext(store, locale);
  if (!ctx) return {};
  const { name, faviconUrl } = ctx.settings;
  return { title: { default: name, template: `%s | ${name}` }, icons: faviconUrl ? { icon: faviconUrl } : undefined };
}

/**
 * The shell around every shopper page: utility bar, header, category navigation, footer and the store picker. The store is
 * already resolved by the proxy (an unknown store answered 404 before this runs; the check here is the belt to its braces).
 */
export default async function StoreLayout({ children, params }: { children: ReactNode; params: Params }) {
  const { locale, store } = await params;
  setRequestLocale(locale);
  const [ctx, session] = await Promise.all([getShellContext(store, locale), getSession()]);
  if (!ctx) notFound();
  const categories = await getNavCategories(ctx.storeId, locale);
  const branches = buildBranchesResponse(ctx, session, new Date());
  const selected = branches.branches.find((b) => b.key === branches.selectedKey);

  return (
    <GarageRoot>
    <StorePickerHost initial={branches}>
      <div className="flex min-h-screen flex-col">
        <SkipLink />
        <UtilityBar store={store} settings={ctx.settings} pickup={selected ? { option: selected.pickup, branchName: selected.name } : undefined} />
        <Header store={store} settings={ctx.settings} signedIn={Boolean(session.customerId)} />
        <CategoryNav store={store} categories={categories} />
        <main id={MAIN_ID} className="flex-1">
          {children}
        </main>
        <Footer store={store} storeName={ctx.settings.name} />
      </div>
    </StorePickerHost>
    </GarageRoot>
  );
}
