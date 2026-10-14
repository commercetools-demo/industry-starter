// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.ts';

/** The commercetools custom-object envelope the real service stores everything in. */
export interface CustomObject {
  id: string;
  version: number;
  versionModifiedAt: string;
  createdAt: string;
  lastModifiedAt: string;
  container: string;
  key: string;
  value: unknown;
}

export const CONTAINERS = {
  configuration: 'configuration',
  puckPage: 'puck-page',
  puckPageState: 'puck-page-state',
  puckPageVersion: 'puck-page-version',
  puckContent: 'puck-content',
  puckContentState: 'puck-content-state',
  puckContentVersion: 'puck-content-version',
} as const;

export const MAX_VERSIONS = 5;

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/**
 * In-memory stand-in for the commercetools custom objects API. Same semantics as the part the real service uses:
 * `POST` is an upsert (version + 1 on overwrite), a missing key is a 404, `DELETE` of a missing key is a 404.
 */
export class CustomObjectStore {
  private readonly objects = new Map<string, CustomObject>();

  private id(container: string, key: string): string {
    return `${container}\u0000${key}`;
  }

  get(container: string, key: string): CustomObject | undefined {
    const o = this.objects.get(this.id(container, key));
    return o ? clone(o) : undefined;
  }

  upsert(container: string, key: string, value: unknown, now = new Date().toISOString()): CustomObject {
    const existing = this.objects.get(this.id(container, key));
    const next: CustomObject = existing
      ? { ...existing, version: existing.version + 1, versionModifiedAt: now, lastModifiedAt: now, value: clone(value) }
      : {
          id: randomUUID(),
          version: 1,
          versionModifiedAt: now,
          createdAt: now,
          lastModifiedAt: now,
          container,
          key,
          value: clone(value),
        };
    this.objects.set(this.id(container, key), next);
    return clone(next);
  }

  delete(container: string, key: string): boolean {
    return this.objects.delete(this.id(container, key));
  }

  list(container: string, filter?: (o: CustomObject) => boolean): CustomObject[] {
    const out: CustomObject[] = [];
    for (const o of this.objects.values()) {
      if (o.container === container && (!filter || filter(o))) out.push(clone(o));
    }
    return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.key.localeCompare(b.key));
  }

  clear(): void {
    this.objects.clear();
  }

  size(): number {
    return this.objects.size;
  }
}

/**
 * Parses the subset of the commercetools query predicate language the real service builds for Puck queries:
 * `field = "text"` clauses joined by `AND`. The real service pastes the client's query into
 * `value(<query> AND businessUnitKey = "<bu>")`; anything this parser does not understand is answered like a
 * commercetools 400 (wrapped by the real `CustomObjectController`).
 */
export function parseValuePredicate(query: string): (value: Record<string, unknown>) => boolean {
  const malformed = (): HttpError =>
    new HttpError(400, 'Failed to get custom objects: Malformed parameter: where. The query predicate could not be parsed.');
  if (typeof query !== 'string' || query.trim() === '') throw malformed();
  const clauses = query.split(/\s+AND\s+/i);
  const tests: Array<(v: Record<string, unknown>) => boolean> = [];
  for (const raw of clauses) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(=|!=)\s*"((?:[^"\\]|\\.)*)"\s*$/.exec(raw);
    if (!m) throw malformed();
    const [, field, op, text] = m as unknown as [string, string, string, string];
    const wanted = text.replace(/\\(.)/g, '$1');
    tests.push((v) => (op === '=' ? String(v[field]) === wanted && v[field] !== undefined : String(v[field]) !== wanted));
  }
  return (v) => tests.every((t) => t(v));
}

export const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
