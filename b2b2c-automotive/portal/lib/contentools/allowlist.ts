// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Allow-list of the Contentools routes the portal proxy forwards (workstream U section 7; workstream X hardens THIS file and
// `proxy-policy.ts`, so keep the names). Patterns are the path after `service/`; `:store` and `:key` are the only placeholders.
// Everything else (refresh-jwt, authenticate-project, health, proxy-script, the generic configuration lists, header, footer
// and the other configuration keys) is not listed and answers 404. Add a route with a test, never a wildcard.
import 'server-only';

export interface AllowRule {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Segments after `service/`, `/` separated. `:store` = the store segment, `:key` = a page or content key. */
  pattern: string;
  /** Only `upload-file` takes a multipart body. */
  multipart?: boolean;
}

const rules = (patterns: string[], methods: AllowRule['method'][]): AllowRule[] => patterns.flatMap((pattern) => methods.map((method) => ({ method, pattern })));
const ALL: AllowRule['method'][] = ['GET', 'POST', 'PUT', 'DELETE'];

/** The managed document kinds share one route set. */
const puckKind = (kind: 'puck-pages' | 'puck-contents'): AllowRule[] => [
  ...rules([`:store/${kind}`, `:store/${kind}/:key`, `:store/${kind}/:key/states`, `:store/${kind}/:key/states/published`, `:store/${kind}/:key/states/draft`, `:store/${kind}/:key/versions`], ALL),
  ...rules([`:store/published/${kind}/:key`, `:store/preview/${kind}/:key`, `:store/published/${kind}/query`, `:store/preview/${kind}/query`], ['GET', 'POST']),
];

export const ALLOW_LIST: readonly AllowRule[] = [
  ...rules([':store/configuration/theme'], ALL),
  ...puckKind('puck-pages'),
  ...puckKind('puck-contents'),
  ...rules([':store/puck-templates', ':store/puck-templates/:key'], ALL),
  { method: 'POST', pattern: ':store/upload-file', multipart: true },
  { method: 'GET', pattern: ':store/media-library' },
  // Product picker of the editors: no store segment (the proxy still injects the project key).
  ...rules(['products/search'], ['GET', 'POST']),
];

/** `{key}` of a page, content item or template. */
export const KEY_SEGMENT = /^[A-Za-z0-9._~-]+$/;
/** A store segment is a commercetools key. */
export const STORE_SEGMENT = /^[A-Za-z0-9_-]{2,256}$/;

export interface RouteMatch {
  /** Methods allowed on the matched path. */
  methods: string[];
  /** Position of the store segment in `segments` after `service` (0), or null for a route without one. */
  storeIndex: number | null;
  multipart: boolean;
}

function segmentMatches(patternSegment: string, segment: string): boolean {
  if (patternSegment === ':store') return STORE_SEGMENT.test(segment);
  if (patternSegment === ':key') return KEY_SEGMENT.test(segment) && segment !== '.' && segment !== '..';
  return patternSegment === segment;
}

/** The allow-list entries whose pattern fits `segments` (the path after `service`), method not yet considered. */
export function matchPath(segments: string[]): RouteMatch | null {
  const fitting = ALLOW_LIST.filter((rule) => {
    const parts = rule.pattern.split('/');
    return parts.length === segments.length && parts.every((p, i) => segmentMatches(p, segments[i]));
  });
  if (fitting.length === 0) return null;
  return {
    methods: [...new Set(fitting.map((r) => r.method))],
    storeIndex: fitting[0].pattern.startsWith(':store') ? 0 : null,
    multipart: fitting.some((r) => r.multipart),
  };
}
