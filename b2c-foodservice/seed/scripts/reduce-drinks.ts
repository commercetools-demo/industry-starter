// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Reduces the scraped Maison Perrier rows to one line per distinct (name, size) pair (design D11).
 * The scraped rows differ only in `Image_URL`; this keeps one line per pair with the distinct, non-empty image URLs in
 * first-appearance order. `sku` is an arbitrary number-only string, sequential from 100001 in output order, so it is
 * stable across runs. `name` and `size` stay plain fields. Rows without a name or category are dropped (a scraped link).
 * Development tool: the seed reads the output (`src/data/drinks.json`), never this script or the source file.
 *
 *   tsx scripts/reduce-drinks.ts <input.json> <output.json>
 */
export interface SourceRow { category?: string; name?: string; size?: string; description?: string; Image_URL?: string }
export interface DrinkLine { sku: string; category: string; name: string; size: string; description: string; images: string[] }
export interface ReduceResult { lines: DrinkLine[]; rowsIn: number; rowsDropped: number; withoutImages: number }

export const FIRST_SKU = 100001;

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&#39;': "'", '&nbsp;': ' ', '&reg;': '®' };

/** HTML (lists, divs, inline styles) to plain text: one paragraph per list item or block, entities decoded. */
export function htmlToText(html: string): string {
  const withBreaks = html.replace(/<\/(li|p|div|h[1-6])>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
  const text = withBreaks.replace(/<[^>]*>/g, '').replace(/&[#a-z0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
  const paragraphs = text.split('\n').map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return [...new Set(paragraphs)].join('\n\n');
}

export function reduceDrinks(rows: SourceRow[]): ReduceResult {
  const byPair = new Map<string, DrinkLine>();
  let rowsDropped = 0;
  for (const r of rows) {
    const name = (r.name ?? '').trim();
    const category = (r.category ?? '').trim();
    if (!name || !category) { rowsDropped += 1; continue; }
    const size = (r.size ?? '').replace(/\s+/g, ' ').trim();
    const pair = JSON.stringify([name, size]);
    let line = byPair.get(pair);
    if (!line) {
      line = { sku: String(FIRST_SKU + byPair.size), category, name, size, description: htmlToText(r.description ?? ''), images: [] };
      byPair.set(pair, line);
    }
    const url = (r.Image_URL ?? '').trim();
    if (url && !line.images.includes(url)) line.images.push(url);
  }
  const lines = [...byPair.values()];
  const skus = new Set(lines.map((l) => l.sku));
  if (skus.size !== lines.length) throw new Error('Duplicate sku in the reduced data');
  return { lines, rowsIn: rows.length, rowsDropped, withoutImages: lines.filter((l) => l.images.length === 0).length };
}

function main(): void {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: tsx scripts/reduce-drinks.ts <input.json> <output.json>');
  const rows = JSON.parse(readFileSync(input, 'utf8')) as SourceRow[];
  const result = reduceDrinks(rows);
  writeFileSync(output, `${JSON.stringify(result.lines, null, 2)}\n`);
  console.log(`rows in ${result.rowsIn}, rows dropped ${result.rowsDropped}, lines out ${result.lines.length}, lines without images ${result.withoutImages}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
