// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Theme adapter: untrusted Contentools ThemeTokens in, automotive token overrides out.
//
// Safety model: nothing from the input is ever copied into CSS. Colours go through parseColour and toHex, enums are
// matched against allow-lists, fonts resolve to registry variables, and the output is assembled from those values only.
// Overrides: only variable groups whose source differs from MALVA_DEFAULT_THEME are emitted, so the default theme gives
// an empty block and the literal tokens of app/tokens.css apply unchanged.
import { hslToRgb, parseColour, rgbToHsl, toHex } from './color';
import { MALVA_DEFAULT_THEME } from './default-theme';
import { firstFamily, resolveFontStack } from './fonts';
import { RADIUS_SCALE, RADIUS_STEPS, isRadiusPreset } from './radius';
import { accentRamp, ACCENT_STOPS, BRAND_STOPS, brandRamp } from './ramp';
import { CARD_SHADOWS, type CardShadow } from './shadows';
import type { ColourKey, CompleteTheme, ThemeVars } from './types';

const BUTTON_STYLES = ['solid', 'outline', 'ghost'] as const;
const CARD_SHADOW_KEYS = Object.keys(CARD_SHADOWS) as CardShadow[];
const SHADOW_STYLES = ['none', 'soft', 'hard-offset', 'neumorphic', 'clay', 'glow'] as const;
const HEADER_STYLES = ['transparent', 'solid', 'minimal'] as const;
const BORDER_WIDTHS = ['0', '1', '2'] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null);
const hexOf = (v: unknown): string | null => {
  const rgb = parseColour(v);
  return rgb ? toHex(rgb) : null;
};

/** Untrusted -> a complete ThemeTokens. Every field is validated; a missing or invalid one takes the default theme's value. */
export function parseTheme(raw: unknown): CompleteTheme {
  const d = MALVA_DEFAULT_THEME;
  if (!isRecord(raw)) return { ...d };
  // Colour fields: a valid colour is re-serialised with toHex; anything else takes the default theme's value.
  const colour = (key: ColourKey): string => hexOf(raw[key]) ?? d[key];
  // Font stacks are kept as the (safe) raw string; resolveFontStack maps them to registry variables later.
  const stack = (value: unknown, fallback: string): string => (typeof value === 'string' && firstFamily(value) !== null ? value : fallback);
  const fontFamily = stack(raw.fontFamily, d.fontFamily);
  const fontHeading = stack(raw.fontHeading, d.fontHeading);

  const colorPrimary = colour('colorPrimary');
  const givenHover = hexOf(raw.colorPrimaryHover);
  // A reseller primary without its own hover gets a derived hover, never the maroon default.
  const colorPrimaryHover = givenHover ?? (colorPrimary === d.colorPrimary ? d.colorPrimaryHover : brandRamp(parseColour(colorPrimary)!)[600]);

  const spacing = raw.spacingScale;
  return {
    colorPrimary,
    colorPrimaryHover,
    colorPrimaryForeground: colour('colorPrimaryForeground'),
    colorSecondary: colour('colorSecondary'),
    colorSecondaryForeground: colour('colorSecondaryForeground'),
    colorBackground: colour('colorBackground'),
    colorSurface: colour('colorSurface'),
    colorText: colour('colorText'),
    colorTextMuted: colour('colorTextMuted'),
    colorAccent: colour('colorAccent'),
    colorBorder: colour('colorBorder'),
    borderRadius: isRadiusPreset(raw.borderRadius) ? raw.borderRadius : d.borderRadius,
    borderWidth: oneOf(BORDER_WIDTHS, raw.borderWidth) ?? d.borderWidth,
    fontFamily,
    fontHeading,
    spacingScale: typeof spacing === 'number' && Number.isFinite(spacing) && spacing >= 0.5 && spacing <= 2 ? spacing : d.spacingScale,
    buttonStyle: oneOf(BUTTON_STYLES, raw.buttonStyle) ?? d.buttonStyle,
    cardShadow: oneOf(CARD_SHADOW_KEYS, raw.cardShadow) ?? d.cardShadow,
    headerStyle: oneOf(HEADER_STYLES, raw.headerStyle) ?? d.headerStyle,
    shadowStyle: oneOf(SHADOW_STYLES, raw.shadowStyle) ?? d.shadowStyle,
  };
}

interface Group {
  /** Compared with the default theme's signature: the group is emitted when they differ. */
  signature: string;
  vars: ThemeVars;
}

const rgbOf = (hex: string) => parseColour(hex)!;

function borderStrong(hex: string): string {
  const hsl = rgbToHsl(rgbOf(hex));
  return toHex(hslToRgb(hsl.h, hsl.s, Math.max(0, hsl.l - 10)));
}

function effectiveShadow(t: CompleteTheme): string {
  // `none` removes the shadow; every other style (soft included) uses the chosen card shadow, the rest is ignored.
  return t.shadowStyle === 'none' ? CARD_SHADOWS.none : CARD_SHADOWS[t.cardShadow];
}

function groupsFor(t: CompleteTheme): Record<string, Group> {
  const brand = brandRamp(rgbOf(t.colorPrimary), rgbOf(t.colorPrimaryHover));
  const accent = accentRamp(rgbOf(t.colorAccent));
  const radius = RADIUS_SCALE[t.borderRadius];
  const bodyStack = resolveFontStack(t.fontFamily);
  const border = t.colorBorder;
  const button =
    t.buttonStyle === 'outline'
      ? { bg: 'transparent', border: 'var(--color-action)', fg: 'var(--color-action)' }
      : t.buttonStyle === 'ghost'
        ? { bg: 'transparent', border: 'transparent', fg: 'var(--color-action)' }
        : { bg: 'var(--color-action)', border: 'transparent', fg: 'var(--color-text-on-brand)' };

  const brandVars: ThemeVars = {};
  for (const s of BRAND_STOPS) brandVars[`--color-brand-${s}`] = brand[s];
  Object.assign(brandVars, {
    '--color-brand-deep': brand[800],
    '--color-action': 'var(--color-brand-700)',
    '--color-text-link': 'var(--color-brand-700)',
    '--color-text-price': 'var(--color-brand-700)',
    '--color-focus': 'var(--color-brand-700)',
    '--color-border-brand': 'var(--color-brand-700)',
    '--color-surface-brand': 'var(--color-brand-700)',
    '--color-action-hover': 'var(--color-brand-600)',
    '--color-action-active': 'var(--color-brand-900)',
    '--color-action-subtle': 'var(--color-brand-50)',
    '--color-surface-brand-subtle': 'var(--color-brand-50)',
    '--color-surface-brand-deep': 'var(--color-brand-deep)',
  });

  const accentVars: ThemeVars = {};
  for (const s of ACCENT_STOPS) accentVars[`--color-accent-${s}`] = accent[s];
  Object.assign(accentVars, {
    '--color-accent-gradient': 'linear-gradient(135deg, var(--color-accent-300), var(--color-accent-600) 55%, var(--color-accent-700))',
    '--color-rating': 'var(--color-accent-600)',
  });

  const radiusVars: ThemeVars = {};
  for (const step of RADIUS_STEPS) radiusVars[`--radius-${step}`] = `${radius[step]}px`;

  return {
    brand: { signature: `${t.colorPrimary}|${t.colorPrimaryHover}`, vars: brandVars },
    onBrand: { signature: t.colorPrimaryForeground, vars: { '--color-text-on-brand': t.colorPrimaryForeground } },
    secondary: { signature: t.colorSecondary, vars: { '--color-surface-utility': t.colorSecondary } },
    accent: { signature: t.colorAccent, vars: accentVars },
    background: { signature: t.colorBackground, vars: { '--color-surface-page': t.colorBackground } },
    surface: { signature: t.colorSurface, vars: { '--color-surface': t.colorSurface, '--color-surface-quiet': t.colorSurface } },
    text: { signature: t.colorText, vars: { '--color-text': t.colorText } },
    textMuted: { signature: t.colorTextMuted, vars: { '--color-text-muted': t.colorTextMuted } },
    border: { signature: border, vars: { '--color-border': border, '--color-border-strong': borderStrong(border) } },
    heading: { signature: resolveFontStack(t.fontHeading), vars: { '--font-display': resolveFontStack(t.fontHeading) } },
    body: { signature: bodyStack, vars: { '--font-body': bodyStack, '--font-ui': bodyStack, '--font-utility': bodyStack } },
    radius: { signature: t.borderRadius, vars: radiusVars },
    shadow: { signature: effectiveShadow(t), vars: { '--shadow-card': effectiveShadow(t) } },
    button: {
      signature: t.buttonStyle,
      vars: { '--btn-secondary-bg': button.bg, '--btn-secondary-border': button.border, '--btn-secondary-fg': button.fg },
    },
  };
}

const DEFAULT_GROUPS = groupsFor(MALVA_DEFAULT_THEME);

/** Only the variables whose group differs from the default theme. */
export function buildThemeVars(raw: unknown): ThemeVars {
  const groups = groupsFor(parseTheme(raw));
  const out: ThemeVars = {};
  for (const [name, group] of Object.entries(groups)) {
    if (group.signature !== DEFAULT_GROUPS[name].signature) Object.assign(out, group.vars);
  }
  return out;
}

/** '' when there are no overrides, else `:root:root{--a:b;...}` (higher specificity than tokens.css, so file order is irrelevant). */
export function buildThemeCss(raw: unknown): string {
  const entries = Object.entries(buildThemeVars(raw));
  if (entries.length === 0) return '';
  return `:root:root{${entries.map(([k, v]) => `${k}:${v}`).join(';')}}`;
}
