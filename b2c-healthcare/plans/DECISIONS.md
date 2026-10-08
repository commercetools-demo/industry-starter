# Decisions

Binding for juniors. `Confirmed` = fixed by an existing artifact or an owner answer. `Proposed` = default from `design/PLAN.md` / `QUESTIONS.md` that we build to until the owner says otherwise. Changing a decision means editing this file **and** the affected workstreams.

## Inherited (from `bootstrap-storefront/design.md` and `design/PLAN.md`)
| ID | Decision | Status | Source |
| --- | --- | --- | --- |
| D-001 | Next.js `^16` App Router, React 19, TypeScript strict, Tailwind v4 via `@tailwindcss/postcss` (no config file), next-intl v4, SWR, jose, npm + lockfile | Confirmed | bootstrap design 1,2,11 |
| D-002 | `@commercetools/platform-sdk ^8`, `@commercetools/ts-client ^4` (skill-pinned) | Confirmed | bootstrap design 3 |
| D-003 | App lives in `b2c-healthcare/site/`; Route Handlers are the BFF | Confirmed | bootstrap design 4 |
| D-004 | Stateless session: jose HS256 JWT, HTTP-only cookie, ids + locale only, 30 days; hard failure on missing/short `SESSION_SECRET` | Confirmed (Q3 of bootstrap noted) | bootstrap design 5,6 |
| D-005 | Locale model = BCP-47 key into `COUNTRY_CONFIG`; `localePrefix: 'always'`; v1 supports `en-US` only | Confirmed | bootstrap design 7 |
| D-006 | `images.unoptimized: true`; imagery URLs stored clean (no query) | Confirmed | bootstrap design 9 + owner request |
| D-007 | Tokens verbatim from `design/source/_ds/tokens.css`; Poppins/Lato/Roboto via `next/font`; design lint from `_adherence.oxlintrc.json` | Confirmed | design-system-tokens |
| D-008 | Container 1200px as `--container-content`; keep `--container-width` verbatim (D2) | Proposed | PLAN D2 |
| D-009 | Add `*-700` status text tokens in a flagged "storefront extensions" block (D3) | Proposed | PLAN D3 |
| D-010 | Primary button: azure fill with `--color-navy-900` label until the design owner confirms (D4) | Proposed → SO-01 | PLAN D4 |
| D-011 | Doctors are catalog **Products** outside the cart; weekly availability, bookings and a create-once slot-claim are **Custom Objects**; bookings are not Orders and not paid online ("pay at the visit") (D1, D5) | Confirmed (Q-001 = A, 2026-10-08) | PLAN D1,D5 |
| D-012 | Guest booking allowed with consent line and retention (D6) | Proposed → Q-025 | PLAN D6 |
| D-013 | RX lookup requires sign-in and the RX must belong to the signed-in patient (D7) | Confirmed | PLAN D7, design-plp |
| D-014 | Same-day shipping is a shipping method; offered only inside the cut-off (D8) | Proposed → Q-013 | PLAN D8 |
| D-015 | Doctor cards/profiles use a Pexels portrait (clean URL, from `update-images.ts`); initials on peach remain the fallback when no image | Confirmed (Q-035, overrules D9) | PLAN D9 |
| D-016 | Mobile: fluid grids + a menu drawer, design review before launch (D10) | Proposed → SO-02 | PLAN D10 |
| D-017 | Header search is wired to search results scoped to doctor name/specialty/medicine (D11) | Confirmed | PLAN D11 |
| D-018 | Lab tests are view-only (D12); Mental health / Second opinion / Health journal links hidden until designed (D13), journal only when articles exist | Confirmed | PLAN D12,D13 |

## Added in planning (2026-10-08, owner instructions)
| ID | Decision | Status |
| --- | --- | --- |
| D-020 | Plans and docs live in `plans/`; the owner is asked questions per spec, answers recorded in `QUESTIONS.md` | Confirmed |
| D-021 | Claude does all browser verification with the Chrome DevTools connector and all project-data checks with the `spec-b2c-health` MCP; the owner only does `TODO-MANUAL-TESTING.md` items | Confirmed |
| D-022 | The commercetools project is seeded by repeatable scripts (`SEED-PLAN.md`); sample data is removed by an explicit confirmed script | Confirmed |
| D-023 | Product and banner images come from the pexels-based `update-images.ts`; stored URLs are clean (no query) | Confirmed |
| D-024 | Unit tests per OpenSpec scenario (Vitest); `npm run check` is the gate named in the bootstrap spec | Confirmed |
| D-025 | Prescriptions, labs and credentials live in Custom Objects behind `lib/clinical/` as a labelled **demo stand-in** for an EHR; synthetic data; patient link = opaque `patientRef` | Confirmed (Q-004 = A) |
| D-026 | Payment = commercetools **Checkout** payment-only mode with a **Stripe** sandbox connector | Confirmed (Q-007 = A) |
| D-028 | Limits enforced in the BFF only in v1 (no API Extension); documented gap vs `dispensing-quantity-limit` "direct API" scenario | Confirmed (Q-005 = B) |
| D-029 | No email provider: registrants auto-verified; no emails are sent; confirmations are on-screen (Q-070..073) | Confirmed (Q-008) |
| D-030 | Hosting = Netlify | Confirmed (Q-009) |
| D-031 | Doctor = one variant; consultation fee per mode is a price on price channel `mlv-remote` / `mlv-office` | Confirmed (Q-002) |
| D-032 | No password-reset UI (Q-070); `password-reset` spec not built | Confirmed |
| D-033 | Tax 0% US on Rx medicine and consultations; Same-day $5 cut-off 14:00 America/New_York, NY/TX/IL only | Confirmed (Q-012/013) |
| D-027 | All capabilities are in v1, including saved lists, subscriptions/recurring orders, payer cost-share, benefit allowance, eligible-item tender and credentialed purchase scope (workstreams T, U) | Confirmed (Q-006, 2026-10-08) |

## Evidence

### D-010 (workstream B-05; computed by `site/lib/a11y/contrast.ts`, asserted in `contrast.test.ts`)
| Label on fill | Ratio | WCAG AA (4.5:1, small text) |
| --- | --- | --- |
| white on `--color-brand-500` `#2aa7ff` (the prototype) | 2.60 | fails |
| `--color-navy-900` `#102851` on `--color-brand-500` (chosen, `--color-action-label`) | 5.59 | passes |
| `--color-navy-900` on `--color-brand-600` `#2593e0` (hover fill) | 4.38 | fails by 0.12 |
| `--color-navy-950` `#081429` on `--color-brand-600` (hover label, `--color-action-label-hover`) | 5.54 | passes |
| white on `--color-brand-700` `#1e78b8` (alternative fill, not chosen) | 4.74 | passes |

D-009 status text on the `-50` background: success `#067a05` 4.93, warning `#8a5d00` 4.98, info `#0a6f8c` 5.18, danger `#b3402a` 4.93 (all pass); the 500 status colors on `-50` all fail.
For SO-01: navy label vs white on a brand-700 fill. `--color-action-label-hover` is a storefront extension added by B because navy-900 does not pass on the hover fill.
