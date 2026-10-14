// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The dependent selectors as a reducer. Build order is Make, Model, Year, Engine (deliberate deviation from the design's
// Year, Make, Model, Engine order: the catalog is keyed by make and model, Q-J05); the labels stay "Year", "Make", "Model", "Engine".
export const LEVELS = ['make', 'model', 'year', 'engine'] as const;
export type Level = (typeof LEVELS)[number];
/** Chosen option keys (slugs; the year is a four digit string). A missing level is not chosen. */
export type Selection = Partial<Record<Level, string>>;

export type SelectorAction = { type: 'select'; level: Level; key: string } | { type: 'reset' };

export const initialSelection: Selection = {};

/** Selecting a level clears every lower level; the empty key clears the level itself. */
export function selectorReducer(state: Selection, action: SelectorAction): Selection {
  if (action.type === 'reset') return initialSelection;
  const index = LEVELS.indexOf(action.level);
  const next: Selection = {};
  for (const level of LEVELS.slice(0, index)) if (state[level]) next[level] = state[level];
  if (action.key) next[action.level] = action.key;
  return next;
}

/** The query that fetches the options of `level` (what is chosen above it), or null while a higher level is still empty. */
export function optionsQuery(state: Selection, level: Level): Selection | null {
  const index = LEVELS.indexOf(level);
  const query: Selection = {};
  for (const above of LEVELS.slice(0, index)) {
    const key = state[above];
    if (!key) return null;
    query[above] = key;
  }
  return query;
}
