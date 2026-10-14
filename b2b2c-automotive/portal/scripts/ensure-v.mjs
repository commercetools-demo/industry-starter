/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// node scripts/ensure-v.mjs [--apply]
// Workstream V prerequisite check (V-00). Idempotent, admin client, dry run unless `--apply`; prints every create or skip.
//  1. VERIFIES that the seed types `malva-checkout`, `malva-line`, `malva-return-item` and `malva-customer` exist with the fields V uses and
//     fails with the list of missing fields. It never creates these types and never creates `malva-order-audit` or
//     `malva-customer-consent`. Only while the seed lacks the field `refundRequestedAt` on `malva-return-item` does it add it
//     (`addFieldDefinition`, additive; the current seed has it, so this step is a no-op).
//  2. Creates the review custom type `malva-review` (`storeKey`, `replyText`, `replyAt`, `replyBy`) and the review states
//     `review-published` (role ReviewIncludedInStatistics, initial) and `review-hidden` (no role: hidden reviews leave the statistics).
// Refuses any project other than the seeded test project. Nothing here runs in `npm run check`.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { connect, fail } from './catalog-live.mjs';

export const EXPECTED_PROJECT = 'spec-test-b2b2c-automotive';

/** Seed types V reads and the fields it relies on. */
export const SEED_FIELDS = {
  'malva-checkout': ['deliveredAt', 'placedOnBehalfBy'],
  'malva-line': ['vehicle', 'fit'],
  'malva-return-item': ['returnNumber', 'status', 'reason', 'refundCents', 'rejectReason', 'refundRequestedAt'],
  'malva-customer': ['garage', 'mobile', 'marketingConsent', 'marketingConsentAt'],
};

/** Missing type or missing fields of one seed type. */
export function typeProblems(key, type) {
  if (!type) return [`custom type ${key} is missing (the seed creates it; V never does)`];
  const names = new Set((type.fieldDefinitions ?? []).map((f) => f.name));
  return SEED_FIELDS[key].filter((n) => !names.has(n)).map((n) => `custom type ${key} has no field ${n}`);
}

const ls = (de, en) => ({ 'de-DE': de, 'en-US': en });
const field = (name, de, en, type, extra = {}) => ({ name, label: ls(de, en), required: false, type, inputHint: 'SingleLine', ...extra });

export const REVIEW_TYPE_KEY = 'malva-review';
export const reviewTypeDraft = () => ({
  key: REVIEW_TYPE_KEY,
  name: ls('Malva Bewertungs-Felder', 'Malva review fields'),
  resourceTypeIds: ['review'],
  fieldDefinitions: [
    field('storeKey', 'Shop (Key)', 'Store key', { name: 'String' }),
    field('replyText', 'Antwort', 'Reply', { name: 'String' }, { inputHint: 'MultiLine' }),
    field('replyAt', 'Antwort am', 'Reply at', { name: 'DateTime' }),
    field('replyBy', 'Antwort von', 'Reply by', { name: 'String' }),
  ],
});

export const reviewStateDrafts = () => [
  { key: 'review-published', type: 'ReviewState', name: ls('Veröffentlicht', 'Published'), initial: true, roles: ['ReviewIncludedInStatistics'] },
  { key: 'review-hidden', type: 'ReviewState', name: ls('Ausgeblendet', 'Hidden'), initial: false, roles: [] },
];

async function main() {
  const apply = process.argv.slice(2).includes('--apply');
  const ctp = await connect();
  if (ctp.projectKey !== EXPECTED_PROJECT) fail(`Refusing project "${ctp.projectKey}": this script only runs against ${EXPECTED_PROJECT}.`);

  const problems = [];
  for (const key of Object.keys(SEED_FIELDS)) {
    const found = await ctp.api('GET', `/types/key=${encodeURIComponent(key)}`).catch(() => null);
    const issues = typeProblems(key, found);
    console.log(`${found ? (issues.length ? 'PROBLEM ' : 'ok      ') : 'MISSING '} custom type ${key}`);
    if (key === 'malva-return-item' && found && issues.length === 1 && issues[0].endsWith('refundRequestedAt')) {
      console.log(`${apply ? 'add     ' : 'would add'} field refundRequestedAt to malva-return-item (the seed lacks it)`);
      if (apply) {
        await ctp.api('POST', `/types/key=${key}`, {
          version: found.version,
          actions: [{ action: 'addFieldDefinition', fieldDefinition: field('refundRequestedAt', 'Erstattung angefordert am', 'Refund requested at', { name: 'DateTime' }) }],
        });
      }
      continue;
    }
    problems.push(...issues);
  }
  if (problems.length) {
    console.error(`\nThe seed is incomplete; nothing was written:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }

  console.log(`\nReview type and states (${apply ? 'applying' : 'dry run, pass --apply to write'}):`);
  const type = await ctp.api('GET', `/types/key=${REVIEW_TYPE_KEY}`).catch(() => null);
  if (type) console.log(`skip    type ${REVIEW_TYPE_KEY} (exists)`);
  else {
    console.log(`${apply ? 'create ' : 'would create'} type ${REVIEW_TYPE_KEY}`);
    if (apply) await ctp.api('POST', '/types', reviewTypeDraft());
  }
  for (const state of reviewStateDrafts()) {
    const exists = await ctp.api('GET', `/states/key=${state.key}`).catch(() => null);
    if (exists) {
      console.log(`skip    state ${state.key} (exists)`);
      continue;
    }
    console.log(`${apply ? 'create ' : 'would create'} state ${state.key}`);
    if (apply) await ctp.api('POST', '/states', state);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
