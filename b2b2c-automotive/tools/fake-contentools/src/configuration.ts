// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { HttpError, RawUpstreamError } from './errors.ts';
import { CONTAINERS, CustomObjectStore } from './store.ts';

/**
 * Port of service/src/controllers/configuration.controller.ts. Everything is a custom object in container
 * `configuration`, key `{businessUnitKey}-{slice}`. Reads of a slice fall back to the `default` namespace.
 */
export const DEFAULT_BUSINESS_UNIT_KEY = 'default';

/** URL segment -> key suffix (constants.ts). */
export const CONFIG_SLICES = {
  theme: 'theme',
  header: 'header',
  facet: 'facet',
  footer: 'footer',
  'site-metadata': 'site-metadata',
  'category-listing': 'category-listing',
  translations: 'translations',
  'b2b-account-menu-links': 'b2b-account-menu-links',
} as const;
export type ConfigSlice = keyof typeof CONFIG_SLICES;

export const configKey = (businessUnitKey: string, slice: ConfigSlice): string => `${businessUnitKey}-${CONFIG_SLICES[slice]}`;

export function getSlice(store: CustomObjectStore, businessUnitKey: string, slice: ConfigSlice): unknown {
  const own = store.get(CONTAINERS.configuration, configKey(businessUnitKey, slice));
  const value = own?.value ?? null;
  if (value != null || businessUnitKey === DEFAULT_BUSINESS_UNIT_KEY) return value;
  return getSlice(store, DEFAULT_BUSINESS_UNIT_KEY, slice);
}

/** `POST` and `PUT` are both a commercetools custom-object upsert in the real service (no 409 ever). */
export function saveSlice(store: CustomObjectStore, businessUnitKey: string, slice: ConfigSlice, value: unknown): unknown {
  // The real service passes `req.body.value` straight to commercetools; an absent value is rejected by commercetools.
  if (value === undefined || value === null) {
    throw new HttpError(400, 'Failed to create custom object: Request body does not contain valid JSON. Missing field: value');
  }
  return store.upsert(CONTAINERS.configuration, configKey(businessUnitKey, slice), value).value;
}

export function deleteSlice(store: CustomObjectStore, businessUnitKey: string, slice: ConfigSlice): void {
  // Real quirk: `deleteCustomObject` returns the SDK promise without awaiting it inside its try/catch, so a missing
  // object surfaces as a raw commercetools error, which the error middleware answers as 500 (not 404).
  if (!store.delete(CONTAINERS.configuration, configKey(businessUnitKey, slice))) {
    throw new RawUpstreamError('ResourceNotFound');
  }
}

export interface AllConfigurationsResult {
  theme: unknown;
  header: unknown;
  facetConfiguration: unknown;
  footer: unknown;
  siteMetadata: unknown;
  categoryListing: unknown;
  translations: unknown;
  contentoolsBaseUrl: string | null;
  b2bAccountMenuLinks: unknown;
}

/** `GET /:bu/configuration` and `/configurations`: every slice, missing ones `null`, each falling back to `default`. */
export function getAllConfigurations(store: CustomObjectStore, businessUnitKey: string): AllConfigurationsResult {
  const baseUrl = (bu: string): string | null => {
    const v = store.get(CONTAINERS.configuration, `${bu}-contentools-base-url`)?.value;
    return typeof v === 'string' ? v : null;
  };
  return {
    theme: getSlice(store, businessUnitKey, 'theme'),
    header: getSlice(store, businessUnitKey, 'header'),
    facetConfiguration: getSlice(store, businessUnitKey, 'facet'),
    footer: getSlice(store, businessUnitKey, 'footer'),
    siteMetadata: getSlice(store, businessUnitKey, 'site-metadata'),
    categoryListing: getSlice(store, businessUnitKey, 'category-listing'),
    translations: getSlice(store, businessUnitKey, 'translations'),
    contentoolsBaseUrl: baseUrl(businessUnitKey) ?? (businessUnitKey === DEFAULT_BUSINESS_UNIT_KEY ? null : baseUrl(DEFAULT_BUSINESS_UNIT_KEY)),
    b2bAccountMenuLinks: getSlice(store, businessUnitKey, 'b2b-account-menu-links'),
  };
}
