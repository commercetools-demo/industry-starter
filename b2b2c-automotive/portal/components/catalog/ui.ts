/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Class strings shared by the catalog screens. Tokens only (admin kit): spacing, radius, text and colour utilities that
// app/globals.css generates from app/tokens.css.
export const cardClass = 'rounded-200 bg-bg-surface p-600 shadow-card';
export const buttonPrimary =
  'inline-flex h-1100 items-center justify-center rounded-300 border border-border-on bg-bg-brand px-450 text-body-2 font-bold text-text-on shadow-button hover:bg-bg-brand-hover disabled:cursor-not-allowed disabled:bg-bg-brand-disabled focus-visible:outline-2 focus-visible:outline-border-active';
export const buttonSecondary =
  'inline-flex h-1100 items-center justify-center rounded-300 border border-border bg-transparent px-450 text-body-2 font-bold text-text hover:bg-bg-surface-hover disabled:cursor-not-allowed disabled:text-text-disabled focus-visible:outline-2 focus-visible:outline-border-active';
/** Small row action (36 px high). */
export const buttonSmall =
  'inline-flex h-1000 items-center justify-center rounded-200 border border-border bg-transparent px-300 text-caption-1 font-bold text-text hover:bg-bg-surface-hover disabled:cursor-not-allowed disabled:text-text-disabled focus-visible:outline-2 focus-visible:outline-border-active';
export const inputClass =
  'h-1100 w-full rounded-300 border border-border-input bg-bg-surface px-300 text-body-2 font-semibold text-text placeholder:text-text-disabled disabled:cursor-not-allowed disabled:bg-bg-surface-disabled focus-visible:outline-2 focus-visible:outline-border-active';
export const textareaClass =
  'min-h-3200 w-full rounded-300 border border-border-input bg-bg-surface px-300 py-250 text-body-2 font-medium text-text placeholder:text-text-disabled focus-visible:outline-2 focus-visible:outline-border-active';
export const labelClass = 'text-body-2 font-semibold text-text';
export const hintClass = 'text-caption-1 font-medium text-text-subdued';
export const thClass = 'px-300 py-250 text-left text-caption-1 font-semibold uppercase tracking-wider text-text-subdued';
export const tdClass = 'px-300 py-300 align-middle text-body-2 text-text';
/** Table wrapper: minimum width 820 px (256 x 3 + 48 + 4) with horizontal scroll inside the card, never on the page. */
export const tableScroll = 'overflow-x-auto';
export const tableMinWidth = 'min-w-[calc(var(--space-6400)*3+var(--space-1200)+var(--space-100))]';
export const errorNote = 'rounded-300 bg-bg-critical-subdued px-300 py-250 text-body-2 font-semibold text-text';
export const infoNote = 'rounded-300 bg-bg-surface-subdued px-300 py-250 text-body-2 font-medium text-text-subdued';
