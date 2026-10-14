/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { tokenMap } from '@/scripts/tokens-source.mjs';

export interface TokenList {
  colors: string[];
  fonts: string[];
  spaces: string[];
  radii: string[];
  shadows: string[];
  texts: string[];
}

/** Names (without the leading dashes) of the tokens in app/tokens.css, grouped for the dev specimen page. */
export function listTokens(root = process.cwd()): TokenList {
  const names = [...tokenMap(readFileSync(path.join(root, 'app', 'tokens.css'), 'utf8')).keys()].map((n) => n.slice(2));
  const group = (prefix: string) => names.filter((n) => n.startsWith(prefix));
  return {
    colors: group('color-'),
    fonts: group('font-'),
    spaces: group('space-'),
    radii: group('radius-'),
    shadows: group('shadow-'),
    texts: group('text-'),
  };
}
