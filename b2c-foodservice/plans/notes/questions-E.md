<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream E (Design system)

Format: `Q-<L>-<n> | question | default | blocks? | status`.

Q-E-1 | VELA `--ink-3 #7C7975` has contrast 4.12 on canvas and 3.81 on canvas-2 (AA needs 4.5); teal text (2.28 on white) and danger text (3.91) also fail. | Change the value of `--ink-3` to `#6E6B67`; add `--teal-text` and `--danger-text`; teal never used for small text; token names unchanged | no | Open
Q-E-2 | Fonts: `next/font/google` (build-time download, self-hosted) or committed local font files? | `next/font/google`; switch to `next/font/local` only if the build machine cannot reach Google Fonts | no | Open
Q-E-3 | Spacing scale. | Tailwind default 4px step, layout in multiples of 8; `--spacing` untouched | no | Open
Q-E-4 | Breakpoint names and `max-*` variants. | `xs 520`, `narrow 700`, `mobile 820`, `stack 900`, `grid3 1080`; `max-*` is strictly below the width (1px difference to the prototype accepted) | no | Open
Q-E-5 | New coffee glyphs `cup`, `bean`, `capsule`, `machine`. | Team draws starter paths (24px, 1.75 stroke, round caps); owner or designer may replace (SO-x) | no | Open
Q-E-6 | Toast ownership (spec atom in E, listed under F in the dependency plan). | E builds `ToastProvider` and `useToast`; F mounts it | F | Open
Q-E-7 | Machine colour swatch values. | `black #1C1B1F`, `white #F7F7F5`, `red #B3262B`, `silver #B8BCC2`, `cream #EADFC8` as `--swatch-*` tokens; unknown key falls back to `--swatch-fallback` | H | Open
Q-E-8 | Footer text colours. | Tokens `--footer-heading`, `--footer-link`, `--footer-meta`; prototype meta `#7979D1` (4.41 on ink) becomes `#8F8FFF` (6.08) | F | Open
Q-E-9 | Dev kitchen-sink page `app/[locale]/dev/design`. | Yes; 404 in production; predeploy check fails while it exists; deleted in Q | no | Open
Q-E-10 | Overlay colour: spec says "42% ink", prototype uses `rgba(14,13,41,0.42)`. | `color-mix(in srgb, var(--ink) 42%, transparent)` (spec wins) | no | Open
Q-E-11 | Focus indicator: the spec names only the 14% accent field ring, too faint to count as focus. | Global `:focus-visible` 2px accent outline, offset 2px, plus the ring on fields | no | Open
Q-E-12 | Entrance animation. | Keep as the prototype (transform-only, `no-preference` only, no opacity) | no | Open
Q-E-13 | Wording choices. | "bag" in all three languages; en-GB uses "Colour"; German reviewed under SO-03 | no | Open
Q-E-14 | Rating atom form. | One star plus number and count (as the design); five-star displays for the review list and form are built in M | M | Open
Q-E-15 | Radius token names. | `--radius-pill`, `--radius-field`, `--radius-card`, `--radius-panel`, `--radius-hero` | no | Open
