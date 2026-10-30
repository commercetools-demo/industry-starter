// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Api, Kind, Res } from './api';
import {
  INSTORE_VISIBILITY_VALUES, instoreCategoryDraft, instoreCategoryTypeDraft, instoreVisibilityField, readyDrinkDrafts, readyDrinkProductType,
} from './data/instore';
import { fail, getAdmin, isMainModule, parseArgs, Runner } from './lib';
import { planProductTypeUpdate, planTypeUpdate } from './sync';

/**
 * In-store seeding, idempotent:
 *  - `npm run seed:instore-visibility`: ensures the custom type `instore-category-type` (resource type category) has the enum
 *    field `instoreVisibility` (onlyInStore, onlyOnline, both, none). An existing type gets the field added; the type is
 *    created when missing. Nothing is removed or retyped.
 *  - `npm run seed:instore`: runs the above, then creates the product type `mcf-ready-drink`, the category
 *    `mcf-cat-instore-drinks` (instoreVisibility onlyInStore, so it stays off the web navigation) and the ready-made drinks
 *    (Americano, Latte, ...) in small and large, published, with USD and CAD prices. Needs the `mcf-tax-food` tax category
 *    (seed step `tax`).
 *
 * Both accept `--dry-run`.
 */
type Obj = Record<string, unknown>;
type Ctx = { api: Api; run: Runner };

async function ensure(c: Ctx, kind: Kind, label: string, draft: Obj, plan?: (e: Res) => Obj[]): Promise<void> {
  const existing = await c.api.getByKey(kind, draft.key as string);
  if (!existing) {
    await c.run.act(`create ${label}`, () => c.api.create(kind, draft));
    return;
  }
  const actions = plan?.(existing) ?? [];
  if (actions.length > 0) await c.run.act(`update ${label}`, () => c.api.update(kind, existing, actions));
}

/** Adds `instoreVisibility` to the type; stops when the field already exists with another type or without all values. */
export async function seedInstoreVisibility(c: Ctx): Promise<void> {
  const existing = await c.api.getByKey('types', instoreCategoryTypeDraft.key);
  const defs = (existing?.fieldDefinitions ?? []) as { name: string; type: { name: string; values?: { key: string }[] } }[];
  const have = defs.find((f) => f.name === instoreVisibilityField.name);
  if (have) {
    const keys = (have.type.values ?? []).map((v) => v.key);
    if (have.type.name !== 'Enum' || !INSTORE_VISIBILITY_VALUES.every((k) => keys.includes(k))) {
      throw new Error(`${instoreCategoryTypeDraft.key}.${have.name} exists as ${have.type.name} [${keys.join(', ')}], expected Enum [${INSTORE_VISIBILITY_VALUES.join(', ')}]. Fix it by hand.`);
    }
  }
  await ensure(c, 'types', `custom type ${instoreCategoryTypeDraft.key}`, instoreCategoryTypeDraft as unknown as Obj, (e) => planTypeUpdate(e, instoreCategoryTypeDraft));
}

export async function seedInstore(c: Ctx): Promise<void> {
  await seedInstoreVisibility(c);
  if (!c.run.dryRun && !(await c.api.getByKey('tax-categories', 'mcf-tax-food'))) {
    throw new Error('tax category mcf-tax-food is missing: run `npm run seed -- --only tax` first');
  }
  await ensure(c, 'product-types', `product type ${readyDrinkProductType.key}`, readyDrinkProductType as unknown as Obj, (e) => planProductTypeUpdate(e, readyDrinkProductType));
  await ensure(c, 'categories', `category ${instoreCategoryDraft.key}`, instoreCategoryDraft as unknown as Obj, (e) =>
    e.custom ? [] : [{ action: 'setCustomType', type: instoreCategoryDraft.custom.type, fields: instoreCategoryDraft.custom.fields }]);
  for (const d of readyDrinkDrafts()) await ensure(c, 'products', `product ${String(d.key)}`, d);
}

async function main() {
  const args = process.argv.slice(2);
  const { dryRun } = parseArgs(args);
  const { api } = await getAdmin();
  const run = new Runner(dryRun);
  if (args.includes('--visibility-only')) await seedInstoreVisibility({ api, run });
  else await seedInstore({ api, run });
  console.log(`${dryRun ? 'dry run: ' : ''}${run.changes} change(s)`);
}

if (isMainModule(import.meta.url)) main().catch(fail);
