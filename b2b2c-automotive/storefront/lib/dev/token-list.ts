// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { tokenMap } from '../../scripts/tokens-source.mjs';

export interface TokenList {
  colors: string[];
  fonts: string[];
  spaces: string[];
  radii: string[];
  shadows: string[];
}

/** Token names (without the leading `--`) from app/tokens.css, grouped for the specimen page. Dev only. */
export function readTokenList(root = process.cwd()): TokenList {
  const names = [...tokenMap(readFileSync(path.join(root, 'app', 'tokens.css'), 'utf8')).keys()].map((n) => n.slice(2));
  const group = (prefix: string) => names.filter((n) => n.startsWith(prefix));
  return { colors: group('color-'), fonts: group('font-'), spaces: group('space-'), radii: group('radius-'), shadows: group('shadow-') };
}
