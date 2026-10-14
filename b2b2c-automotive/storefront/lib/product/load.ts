// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Everything one product page needs, read on the server (workstream M). Flow: store, session and active vehicle in parallel; the
// product (store projection, master, standalone prices); then related parts, reviews and the review-form state in parallel.
// `getProductPage` runs once per request (React `cache`): the page and its `generateMetadata` both ask.
import 'server-only';
import { cache } from 'react';
import type { PdpBranch } from '@/components/product/detail/AvailabilityBlock';
import type { ReviewFormState } from '@/components/product/detail/ReviewForm';
import type { AppLocale } from '@/i18n/config';
import { getBundleView } from '@/lib/ct/bundles';
import { getProductBySlug, getRelatedSummaries } from '@/lib/ct/product-detail';
import { getReviewEligibility, listReviews, reviewSubmissionEnabled } from '@/lib/ct/reviews';
import { getShellContext } from '@/lib/ct/shell';
import { getSession } from '@/lib/session';
import { getBranchScope } from '@/lib/store/branch-scope';
import { buildBranchesResponse } from '@/lib/store/branches-view';
import { subscriptionsPurchaseEnabled } from '@/lib/subscriptions/config';
import type { BundleView, ProductDetail, ProductSummary, ReviewItem } from '@/lib/types';
import { getActiveVehicle } from '@/lib/vehicles/active';
import { COUNTRY_CONFIG } from '@/lib/utils';

export const DEFAULT_RETURN_DAYS = 30;

export interface ProductPageView {
  kind: 'ok';
  product: ProductDetail;
  related: ProductSummary[];
  reviews: ReviewItem[];
  reviewForm: ReviewFormState | null;
  /** Components and how many can be sold, for a bundle (W-11); null for a plain part. */
  bundle: BundleView | null;
  branch: PdpBranch | null;
  canChangeStore: boolean;
  shipDays: { min: number; max: number };
  sellerName: string;
  returnDays: number;
  subscriptionsEnabled: boolean;
  /** Locale-less address of the fitting alternatives: the product's category (fit-only with a vehicle) or all parts. */
  alternativesHref: string;
}
export type ProductPageResult = ProductPageView | { kind: 'not-found' };

const attempt = async <T>(work: Promise<T>, fallback: T, label: string): Promise<T> => {
  try {
    return await work;
  } catch {
    console.error(`[pdp] ${label} could not be read`);
    return fallback;
  }
};

async function loadProductPage(storeKey: string, locale: AppLocale, slug: string, sku: string | undefined): Promise<ProductPageResult> {
  const [shell, session, vehicle] = await Promise.all([getShellContext(storeKey, locale), getSession(), getActiveVehicle()]);
  if (!shell) return { kind: 'not-found' };
  const { currency, country } = COUNTRY_CONFIG[locale];
  const scope = getBranchScope(session, shell.branches, shell.retailChannelId);
  const ctx = { locale, currency, country, branchChannelId: scope.branchChannelId, retailChannelId: scope.retailChannelId };

  const product = await getProductBySlug(storeKey, slug, ctx, sku);
  if (!product) return { kind: 'not-found' };

  const customerId = session.customerId;
  const [related, reviews, reviewForm, bundle] = await Promise.all([
    attempt(getRelatedSummaries(storeKey, product, ctx, { storeId: shell.storeId, fitKeys: vehicle ? vehicle.fitKeys : null }), [], 'related parts'),
    attempt(listReviews(product.id, storeKey), [], 'reviews'),
    reviewFormState(storeKey, customerId, product.id),
    bundleState(storeKey, locale, product, scope.branchChannelId),
  ]);

  const branches = buildBranchesResponse(shell, session, new Date());
  const selected = branches.branches.find((b) => b.key === branches.selectedKey);
  const category = product.categoryTrail[product.categoryTrail.length - 1];
  return {
    kind: 'ok',
    product,
    related,
    reviews,
    reviewForm,
    bundle,
    branch: selected ? { name: selected.name, address: selected.address, pickup: selected.pickup } : null,
    canChangeStore: !branches.single,
    shipDays: shell.settings.shipDays,
    sellerName: shell.settings.name,
    returnDays: shell.settings.returnWindowDays ?? DEFAULT_RETURN_DAYS,
    subscriptionsEnabled: subscriptionsPurchaseEnabled(),
    alternativesHref: category ? `/${storeKey}/category/${category.slug}` : `/${storeKey}/parts`,
  };
}

/** A bundle's components for the page. A read that fails makes the bundle unavailable: it is never sold blind. */
async function bundleState(storeKey: string, locale: AppLocale, product: ProductDetail, branchChannelId: string | undefined): Promise<BundleView | null> {
  const components = product.bundleComponents;
  if (!components) return null;
  return attempt<BundleView>(
    getBundleView(storeKey, locale, components, branchChannelId),
    { components: components.map((c) => ({ ...c, name: c.sku, inStore: false })), available: 0 },
    'bundle components',
  );
}

async function reviewFormState(storeKey: string, customerId: string | undefined, productId: string): Promise<ReviewFormState | null> {
  if (!reviewSubmissionEnabled()) return null;
  if (!customerId) return 'signed-out';
  return attempt<ReviewFormState | null>(getReviewEligibility(storeKey, customerId, productId), null, 'review eligibility');
}

const loadOnce = cache((storeKey: string, locale: AppLocale, slug: string, sku: string) => loadProductPage(storeKey, locale, slug, sku || undefined));

export function getProductPage(input: { storeKey: string; locale: AppLocale; slug: string; sku?: string }): Promise<ProductPageResult> {
  return loadOnce(input.storeKey, input.locale, input.slug, input.sku ?? '');
}
