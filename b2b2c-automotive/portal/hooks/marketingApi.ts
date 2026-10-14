/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

// Client side of workstream W's screens (Marketing, E-mail, Bundles, Product import, Brand partnership): SWR reads and plain async
// writes against `/api/seller/**`. The only place these screens reach the network (hook-only fetching). The server re-checks the
// store and the role on every call. Types are imported with `import type`, so no server module reaches the browser.
import useSWR from 'swr';
import type { MappingOverrides } from '@/lib/import/columns';
import type { Rule } from '@/lib/marketing/audience';
import type { BundleInput, BundleView, Brand, CampaignView, ClaimInput, CommitResult, ComponentOption, EmailCampaignView, EventView, LocalProductResult, LocalProductRow, Partnership, Preview, SuggestResult, TemplateView, ValidationReport, VehicleOption } from '@/lib/w-types';
import type { LocalProductInput } from '@/lib/import/local-product';
import { sendJson, type CatalogResult } from './catalogApi';
import { swrFetcher } from './http';

export type { BundleInput, BundleView, CampaignView, ClaimInput, CommitResult, ComponentOption, EmailCampaignView, EventView, LocalProductResult, LocalProductRow, Partnership, Preview, SuggestResult, TemplateView, ValidationReport, VehicleOption, Brand };
export type { CatalogResult };

type Localized = { 'de-DE': string; 'en-US': string };

const q = (storeKey: string) => `storeKey=${encodeURIComponent(storeKey)}`;
function useRead<T>(url: string | null) {
  return useSWR<T>(url, swrFetcher<T>, { revalidateOnFocus: false });
}

// ---- Marketing ----
export const useCampaigns = (storeKey: string) => useRead<{ campaigns: CampaignView[] }>(`/api/seller/campaigns?${q(storeKey)}`);
export const campaignApi = {
  createDiscount: (storeKey: string, campaignKey: string) => sendJson<{ id: string; key: string; code: string; isActive: false }>('POST', `/api/seller/campaigns/${encodeURIComponent(campaignKey)}/discount`, { storeKey }),
  claim: (storeKey: string, campaignKey: string, input: ClaimInput) => sendJson<{ status: 'submitted' }>('POST', `/api/seller/campaigns/${encodeURIComponent(campaignKey)}/claim`, { storeKey, ...input }),
};

// ---- E-mail (stored, never sent) ----
export const useEmailTemplates = (storeKey: string) => useRead<{ templates: TemplateView[]; events: EventView[]; brand: Brand }>(`/api/seller/email/templates?${q(storeKey)}`);
export const useEmailCampaigns = (storeKey: string) => useRead<{ campaigns: EmailCampaignView[] }>(`/api/seller/email/campaigns?${q(storeKey)}`);
export const emailApi = {
  save: (storeKey: string, key: string, input: { subject: Localized; body: Localized; enabled: boolean }) => sendJson<TemplateView>('PUT', `/api/seller/email/templates/${encodeURIComponent(key)}`, { storeKey, ...input }),
  preview: (storeKey: string, key: string, input: { subject: Localized; body: Localized }) => sendJson<Preview & { brand: Brand }>('POST', `/api/seller/email/templates/${encodeURIComponent(key)}/preview`, { storeKey, ...input }),
  suggest: (storeKey: string, description: string) => sendJson<SuggestResult>('POST', '/api/seller/email/campaigns/suggest', { storeKey, description }),
  createCampaign: (storeKey: string, input: { name: string; templateKey: string; rule: Rule }) => sendJson<EmailCampaignView>('POST', '/api/seller/email/campaigns', { storeKey, ...input }),
  markReady: (storeKey: string, id: string) => sendJson<EmailCampaignView>('POST', `/api/seller/email/campaigns/${encodeURIComponent(id)}/ready`, { storeKey }),
};

// ---- Bundles ----
export const useBundles = (storeKey: string) => useRead<{ bundles: BundleView[] }>(`/api/seller/bundles?${q(storeKey)}`);
export const useBundleComponents = (storeKey: string, text: string) => useRead<{ components: ComponentOption[] }>(`/api/seller/bundles/components?${q(storeKey)}${text ? `&text=${encodeURIComponent(text)}` : ''}`);
export const bundleApi = {
  create: (storeKey: string, input: BundleInput) => sendJson<BundleView>('POST', '/api/seller/bundles', { storeKey, ...input }),
  publish: (storeKey: string, key: string) => sendJson<BundleView>('POST', `/api/seller/bundles/${encodeURIComponent(key)}/publish`, { storeKey }),
};

// ---- Local products and CSV import ----
export const useLocalProducts = (storeKey: string) => useRead<{ products: LocalProductRow[] }>(`/api/seller/local-products?${q(storeKey)}`);
export const useVehicles = (storeKey: string) => useRead<{ vehicles: VehicleOption[] }>(`/api/seller/local-products/vehicles?${q(storeKey)}`);
export const useCategories = (storeKey: string) => useRead<{ categories: { id: string; key: string; name: Record<string, string>; parentId?: string }[] }>(`/api/seller/catalog/categories?${q(storeKey)}`);
export const localApi = {
  create: (storeKey: string, input: LocalProductInput) => sendJson<LocalProductResult>('POST', '/api/seller/local-products', { storeKey, ...input }),
};
export const importApi = {
  validate: (storeKey: string, csv: string, overrides?: MappingOverrides) => sendJson<ValidationReport>('POST', '/api/seller/import/validate', { storeKey, csv, ...(overrides && Object.keys(overrides).length ? { overrides } : {}) }),
  commit: (storeKey: string, csv: string, overrides?: MappingOverrides) => sendJson<CommitResult>('POST', '/api/seller/import/commit', { storeKey, csv, ...(overrides && Object.keys(overrides).length ? { overrides } : {}) }),
};

// ---- Brand partnership ----
export const usePartnership = (storeKey: string) => useRead<Partnership>(`/api/seller/partnership?${q(storeKey)}`);
