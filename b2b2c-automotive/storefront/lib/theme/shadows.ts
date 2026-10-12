// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Card shadow scale. Raw values are the purpose of this file (exempt in check-tokens).
export const CARD_SHADOWS = {
  none: 'none',
  sm: '0 0 10px rgba(0,0,0,.05)',
  md: '0 4px 12px rgba(0,0,0,.08)',
  lg: '0 8px 24px rgba(0,0,0,.12)',
} as const;

export type CardShadow = keyof typeof CARD_SHADOWS;
