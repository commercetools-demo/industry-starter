// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Radius scale per `borderRadius`, in px. `md` is the design default (tokens.css). Raw sizes are the purpose of this
// file (exempt in check-tokens).
export type RadiusPreset = 'none' | 'sm' | 'md' | 'lg' | 'full';
export type RadiusStep = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'pill';

export const RADIUS_STEPS: readonly RadiusStep[] = ['xs', 'sm', 'md', 'lg', 'xl', 'pill'];

export const RADIUS_SCALE: Record<RadiusPreset, Record<RadiusStep, number>> = {
  none: { xs: 0, sm: 0, md: 0, lg: 0, xl: 0, pill: 0 },
  sm: { xs: 1, sm: 2, md: 3, lg: 4, xl: 8, pill: 14 },
  md: { xs: 2, sm: 3, md: 5, lg: 7, xl: 14, pill: 28 },
  lg: { xs: 4, sm: 6, md: 10, lg: 14, xl: 20, pill: 28 },
  full: { xs: 4, sm: 999, md: 12, lg: 16, xl: 24, pill: 999 },
};

export const isRadiusPreset = (v: unknown): v is RadiusPreset => typeof v === 'string' && Object.hasOwn(RADIUS_SCALE, v);
