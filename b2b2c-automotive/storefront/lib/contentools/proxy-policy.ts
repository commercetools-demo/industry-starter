// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Allow-list for the same-origin Contentools proxy. The storefront holds no Contentools JWT, so it only needs reads:
// GET routes and the published-page / published-content query POST. Everything else is not allowed and the route answers
// 404 without any upstream request. Add a route here (with a test) when a Puck block needs another read.
import 'server-only';

const NAME = /^[A-Za-z0-9_-]{2,256}$/;
const PUBLISHED_KINDS = new Set(['puck-pages', 'puck-contents']);

const isName = (s: string | undefined): s is string => s !== undefined && NAME.test(s);

export function isAllowed(method: string, segments: string[]): boolean {
  if (segments.length < 2 || segments[0] !== 'service') return false;
  const verb = method.toUpperCase();

  if (verb === 'GET') {
    // service/<store>/configuration/theme
    if (segments.length === 4 && isName(segments[1]) && segments[2] === 'configuration' && segments[3] === 'theme') return true;
    // service/<store>/published/{puck-pages|puck-contents}/<key>
    if (segments.length === 5 && isName(segments[1]) && segments[2] === 'published' && PUBLISHED_KINDS.has(segments[3]) && isName(segments[4])) return true;
    // service/datasource, service/datasource/<key>, service/products/search
    if (segments.length === 2 && segments[1] === 'datasource') return true;
    if (segments.length === 3 && segments[1] === 'datasource' && isName(segments[2])) return true;
    if (segments.length === 3 && segments[1] === 'products' && segments[2] === 'search') return true;
    return false;
  }

  if (verb === 'POST') {
    // service/<store>/published/{puck-pages|puck-contents}/query
    return segments.length === 5 && isName(segments[1]) && segments[2] === 'published' && PUBLISHED_KINDS.has(segments[3]) && segments[4] === 'query';
  }

  return false;
}
