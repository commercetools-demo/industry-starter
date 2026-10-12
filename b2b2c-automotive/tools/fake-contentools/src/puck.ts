// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { randomUUID } from 'node:crypto';
import { HttpError, RawUpstreamError } from './errors.ts';
import { asRecord, CONTAINERS, CustomObject, CustomObjectStore, MAX_VERSIONS, parseValuePredicate } from './store.ts';

/**
 * Port of puck-page.controller.ts, puck-content.controller.ts, content-state-controller.ts and
 * content-version-controller.ts. Pages and contents share the same draft/published/version machinery, so one
 * parameterised implementation serves both.
 *
 * Notes copied from the real service:
 * - objects live in a container keyed by a global `puck-page-<uuid>` / `puck-content-<uuid>` key (not per business
 *   unit); the business unit is a field of the value and is part of the state key `<bu>_<key>`;
 * - there is NO fallback to the `default` namespace for pages or contents (only the theme and other configuration
 *   slices fall back);
 * - a query is `value(<client predicate> AND businessUnitKey = "<bu>")`.
 */
export interface Kind {
  name: 'page' | 'content';
  content: string;
  state: string;
  version: string;
  keyPrefix: string;
  /** Message used for "not found" answers of the published and preview routes. */
  publishedMissing: string;
  previewMissing: string;
}

export const PAGE_KIND: Kind = {
  name: 'page',
  content: CONTAINERS.puckPage,
  state: CONTAINERS.puckPageState,
  version: CONTAINERS.puckPageVersion,
  keyPrefix: 'puck-page-',
  publishedMissing: 'Published puck page not found',
  previewMissing: 'Puck page not found',
};

export const CONTENT_KIND: Kind = {
  name: 'content',
  content: CONTAINERS.puckContent,
  state: CONTAINERS.puckContentState,
  version: CONTAINERS.puckContentVersion,
  keyPrefix: 'puck-content-',
  publishedMissing: 'Published puck content not found',
  previewMissing: 'Puck content not found',
};

interface StateValue {
  key: string;
  businessUnitKey: string;
  states: { draft?: unknown; published?: unknown };
}

const now = (): string => new Date().toISOString();
const notFound = (key: string): HttpError => new HttpError(404, `Custom object not found with key: ${key}`);

function getObject(store: CustomObjectStore, container: string, key: string): CustomObject {
  const o = store.get(container, key);
  if (!o) throw notFound(key);
  return o;
}

function stateOf(store: CustomObjectStore, kind: Kind, bu: string, key: string): StateValue | undefined {
  return store.get(kind.state, `${bu}_${key}`)?.value as StateValue | undefined;
}

function freshState(bu: string, key: string): StateValue {
  return { key, businessUnitKey: bu, states: {} };
}

/** `getContentStatesWithWhereClause(key = .. AND businessUnitKey = ..)`: states are matched on the state's value. */
function stateByValue(store: CustomObjectStore, kind: Kind, bu: string, key: string): StateValue | undefined {
  const hit = store.list(kind.state, (o) => {
    const v = asRecord(o.value);
    return v.key === key && v.businessUnitKey === bu;
  })[0];
  return hit?.value as StateValue | undefined;
}

function createDraftState(store: CustomObjectStore, kind: Kind, bu: string, key: string, value: Record<string, unknown>): StateValue {
  const state = stateOf(store, kind, bu, key) ?? freshState(bu, key);
  const existing = getObject(store, kind.content, key);
  state.states = { ...state.states, draft: { ...asRecord(existing.value), ...value } };
  return store.upsert(kind.state, `${bu}_${key}`, state).value as StateValue;
}

function createPublishedState(
  store: CustomObjectStore,
  kind: Kind,
  bu: string,
  key: string,
  value: Record<string, unknown>,
  clearDraft: boolean,
): StateValue {
  const state = stateOf(store, kind, bu, key) ?? freshState(bu, key);
  const existing = getObject(store, kind.content, key);
  state.states = { ...state.states, published: { ...asRecord(existing.value), ...value } };
  if (clearDraft) state.states = { ...state.states, draft: undefined };
  return store.upsert(kind.state, `${bu}_${key}`, state).value as StateValue;
}

function createVersion(store: CustomObjectStore, kind: Kind, bu: string, key: string, value: Record<string, unknown>): void {
  const versionKey = `${bu}_${key}`;
  const existing = (store.get(kind.version, versionKey)?.value as { versions: unknown[] } | undefined) ?? { versions: [] };
  const versions = [{ ...value, timestamp: now(), id: randomUUID() }, ...existing.versions].slice(0, MAX_VERSIONS);
  store.upsert(kind.version, versionKey, { key, businessUnitKey: bu, versions });
}

/** The real `deleteCustomObject` does not await the SDK promise inside its try/catch: missing = raw error = 500. */
function deleteOrRaw(store: CustomObjectStore, container: string, key: string): void {
  if (!store.delete(container, key)) throw new RawUpstreamError('ResourceNotFound');
}

export function list(store: CustomObjectStore, kind: Kind, bu: string, contentType?: string): unknown[] {
  const objects = store.list(kind.content, (o) => {
    const v = asRecord(o.value);
    return v.businessUnitKey === bu && (contentType === undefined || v.contentType === contentType);
  });
  return objects.map((o) => ({ ...o, states: stateByValue(store, kind, bu, o.key)?.states ?? {} }));
}

export function getWithStates(store: CustomObjectStore, kind: Kind, bu: string, key: string): unknown {
  const object = getObject(store, kind.content, key);
  return { ...object, states: stateOf(store, kind, bu, key)?.states ?? {} };
}

export function create(store: CustomObjectStore, kind: Kind, bu: string, input: Record<string, unknown>): CustomObject {
  if (!input.name) throw new HttpError(400, 'name is required');
  if (kind.name === 'page' && !input.slug) throw new HttpError(400, 'slug is required');
  if (kind.name === 'content' && !input.contentType) throw new HttpError(400, 'contentType is required');
  const key = `${kind.keyPrefix}${randomUUID()}`;
  const value: Record<string, unknown> =
    kind.name === 'page'
      ? {
          key,
          businessUnitKey: bu,
          name: input.name,
          slug: input.slug,
          puckData: input.puckData ?? { content: [], root: { props: {} } },
          meta: input.meta,
          createdAt: now(),
          updatedAt: now(),
        }
      : {
          key,
          businessUnitKey: bu,
          name: input.name,
          contentType: input.contentType,
          data: input.data ?? {},
          meta: input.meta,
          createdAt: now(),
          updatedAt: now(),
        };
  const object = store.upsert(kind.content, key, value);
  createDraftState(store, kind, bu, key, value);
  createVersion(store, kind, bu, key, value);
  return object;
}

export function update(store: CustomObjectStore, kind: Kind, bu: string, key: string, input: Record<string, unknown>): CustomObject {
  const existing = getObject(store, kind.content, key);
  // Like the real service, every field of the request value is merged (only key and businessUnitKey are pinned).
  const value = { ...asRecord(existing.value), ...input, businessUnitKey: bu, key, updatedAt: now() };
  const object = store.upsert(kind.content, key, value);
  createDraftState(store, kind, bu, key, value);
  createVersion(store, kind, bu, key, value);
  return object;
}

export function remove(store: CustomObjectStore, kind: Kind, bu: string, key: string): void {
  deleteOrRaw(store, kind.content, key);
  deleteOrRaw(store, kind.state, `${bu}_${key}`);
  deleteOrRaw(store, kind.version, `${bu}_${key}`);
}

function firstWithState(store: CustomObjectStore, kind: Kind, bu: string, key: string, wanted: string[]): unknown {
  const state = stateByValue(store, kind, bu, key);
  if (!state) return undefined;
  for (const s of wanted) {
    const v = (state.states as Record<string, unknown>)[s];
    if (v) return v;
  }
  return undefined;
}

export function getPublished(store: CustomObjectStore, kind: Kind, bu: string, key: string): unknown {
  const v = firstWithState(store, kind, bu, key, ['published']);
  if (!v) throw new HttpError(404, kind.publishedMissing);
  return v;
}

export function getPreview(store: CustomObjectStore, kind: Kind, bu: string, key: string): unknown {
  const v = firstWithState(store, kind, bu, key, ['draft', 'published']);
  if (!v) throw new HttpError(404, kind.previewMissing);
  return v;
}

export function query(store: CustomObjectStore, kind: Kind, bu: string, q: unknown, wanted: Array<'draft' | 'published'>): unknown {
  if (!q) throw new HttpError(400, 'query is required in request body');
  const predicate = parseValuePredicate(String(q));
  const hits = store.list(kind.content, (o) => {
    const v = asRecord(o.value);
    return predicate(v) && v.businessUnitKey === bu;
  });
  const miss = wanted.length === 1 ? kind.publishedMissing : kind.previewMissing;
  const first = hits[0];
  if (!first) throw new HttpError(404, miss);
  const v = firstWithState(store, kind, bu, first.key, wanted);
  if (!v) throw new HttpError(404, miss);
  return v;
}

export function getStates(store: CustomObjectStore, kind: Kind, bu: string, key: string): StateValue {
  return stateOf(store, kind, bu, key) ?? freshState(bu, key);
}

export function publish(store: CustomObjectStore, kind: Kind, bu: string, key: string, clearDraft: boolean): StateValue {
  const object = getObject(store, kind.content, key);
  return createPublishedState(store, kind, bu, key, asRecord(object.value), clearDraft);
}

export function revertDraft(store: CustomObjectStore, kind: Kind, bu: string, key: string): StateValue {
  const state = stateOf(store, kind, bu, key) ?? freshState(bu, key);
  if (!state.states.published) throw new HttpError(404, 'No published state found');
  state.states = { ...state.states, draft: undefined };
  store.upsert(kind.content, key, { ...asRecord(state.states.published), businessUnitKey: bu });
  return store.upsert(kind.state, `${bu}_${key}`, state).value as StateValue;
}

export function getVersions(store: CustomObjectStore, kind: Kind, bu: string, key: string): unknown {
  return store.get(kind.version, `${bu}_${key}`)?.value ?? { key, businessUnitKey: bu, versions: [] };
}
