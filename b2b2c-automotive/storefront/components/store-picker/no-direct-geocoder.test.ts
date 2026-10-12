// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe('Nominatim proxy: browser code', () => {
  it('no direct nominatim call from components', () => {
    const files = ['components', 'hooks', 'context'].flatMap((d) => walk(path.join(root, d))).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, path.relative(root, file)).not.toMatch(/nominatim\.openstreetmap\.org/i);
      expect(text, path.relative(root, file)).not.toMatch(/lib\/geo\/nominatim/);
    }
  });
});
