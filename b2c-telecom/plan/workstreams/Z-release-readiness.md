# Z — Release readiness, spec reconciliation, final verification

**Specs:** all capabilities; records `agent-redemption-quota` (deferred), `account-registration-request` (not built) and `product-detail-page` (superseded by `plp-led-catalog-navigation`) as not built
**Depends on:** A–Y · **Unblocks:** — · **Decisions:** D-003, D-005, D-022, D-031, D-032, D-034, D-040, D-059
**Owner prerequisites:** all OA-* (OA-02 … OA-06) · **Skill refs:** none (reads the other workstreams' results)

## Goal
The repository tells the truth: every spec says what was and was not built, every scenario has a passing test, Claude has run the full journeys end to end in Chrome on the live project and on the Netlify deployment, secrets are clean, and a new developer can clone, install, seed and run.

## Design

### Spec reconciliation (task Z-01, Z-02)
Specs are the contract, and several were narrowed by owner decisions (see `DECISIONS.md` D-005 and the "Superseded or implied changes" block). Each narrowed spec (except `contact-us`, `faq`, `about-us`, whose notes W-09 writes) gets, directly under its `## Purpose` section, a `## Plan notes` section (3–8 lines) stating exactly what v1 does differently, the decision id, and which scenarios are replaced or excluded **by their exact titles**. Do not delete or rewrite scenarios; excluded ones stay as written so the contract remains visible.

| Spec | Plan notes content |
| --- | --- |
| `agent-redemption-quota` | **Deferred** (D-022): no agent mode in v1; spec kept for a later change |
| `account-registration-request` | **Not built** (D-005/D-031): consumers register instantly |
| `product-detail-page` | **Superseded** by `plp-led-catalog-navigation` (D-052); route is a 404 |
| `email-verification` | Reduced to auto-verify at registration (D-031) |
| `password-reset` | Demo-mode link on screen (D-033) |
| `contact-us` | `mailto:` link, no form (D-034) |
| `payment-methods` | List-only with seeded records; net terms excluded (D-032) |
| `account-dashboard`, `order-history`, `account-and-self-service`, `cart-page`, `checkout-page`, `home-landing-page`, `address-book`, `saved-lists` | B2B-only parts excluded (D-005): list them |
| `post-purchase-order-management` | Cancel before service start + 30-day device return request only (D-040) |
| `coordinated-offer-release` | Seeder-applied release manifests, no approval UI (D-057) |
| `seed-product-images-pexels` | Method per D-055 |
| `storefront-shell` | Terms and mobile decisions D-050, D-051 |
| `telecom-catalog-model` | Attributes added by G beyond the spec's table (`end-time`, `offer-family`, `intro-free-months`, `price-steps`, `addon-tag`, `label-plan-id`, `bundle-discount-text`, `activation-fee`, plan facts copied onto offers); extra recurrence policies `malva-device-installment-12/24/36`, `malva-device-lease-24`; customer-group keys are not `malva-` prefixed (D-058) |
| `seeding-framework`, `seed-shipping-and-market-settings` | Seed code lives in `site/scripts/seed/` (not a sibling `seed/` package); zones `usa` and `europe` adopted, not created; sample shipping methods cannot be deleted so the BFF keeps only `malva-*` methods |
| `storefront-code-structure`, `account-sign-in` | Session module is `lib/ct/session.ts`; stateless signed cookie holds no customer token, queries are scoped by `customerId` |
| `contact-us`, `faq`, `about-us` | Plan notes are written by W-09; Z-01 only checks that they exist |

### Final verification (task Z-03 … Z-06)
- `npm run verify:release` = `npm run verify` + `node scripts/check-release.mjs` (from Y): no `TODO`/`FIXME` without an `IDEAS.md` entry, `.env.example` complete, no secrets in git history of `site/` (`git log -p -- site | grep` patterns in `check-secrets`), lockfile single, Node 22.
- Coverage: `node plan/verify-plan.mjs` must print `plan verification: OK` with `uncovered: 0` and every task ticked.
- Clean-clone check: clone into a temp directory, `nvm use`, `npm ci`, `npm run verify`, `npm run seed:verify` (needs `.env.seed`), `npm run dev`, open `/en-US`.
- Chrome full-journey checks (Claude): see C-Z-1 … C-Z-8 below; each is run on `http://localhost:3000` against `spec-test-b2c-telecom` and repeated on the Netlify URL (C-Z-9).
- Accessibility and performance: Lighthouse (mobile and desktop) on `/`, a listing, `/bundle`, `/login`, `/account`; targets: accessibility ≥ 95, best practices ≥ 95, SEO ≥ 90 on public pages, no console errors.
- Security review: run the `/security-review` skill on the full branch; zero high findings; headers present (CSP, X-Content-Type-Options, Referrer-Policy) on the deployed site.
- Close-out: revoke the seed/admin API client (owner action), archive the final status in `plan/FINAL-REPORT.md` (what was built, what was deferred, measured Lighthouse scores, verification log summary).

## Tasks
- [ ] Z-01 Add the `## Plan notes` sections listed in the table to the specs under `openspec/specs/**/spec.md` (one commit per 4 specs); `openspec validate --specs` must still pass.
- [ ] Z-02 Create `plan/COVERAGE-REPORT.md`: a table capability → workstream(s) → scenario count → status (built / deferred / superseded) generated by running `node plan/verify-plan.mjs` and copying its totals; list every deferred or excluded scenario title with its decision id.
- [ ] Z-03 Run `npm run verify:release` from a clean clone (`rm -rf node_modules .next && npm ci`); fix only release-config problems here, file anything else in `QUESTIONS.md`.
- [ ] Z-04 Run the code-review skill (`/code-review high`) and the security-review skill on the whole `site/` tree; record findings in `plan/FINAL-REPORT.md`; fix only findings approved by the owner; each fix is its own commit with a test.
- [ ] Z-05 Re-run Lighthouse on the five pages above (mobile + desktop) and record scores in `FINAL-REPORT.md`; any score below target becomes a fix task in the owning workstream file (append `<LETTER>-NN`, do not renumber).
- [ ] Z-06 Write `plan/FINAL-REPORT.md` (what was built per workstream, deferred items with decisions, known risks: Pexels endpoint D-055, stub systems D-020/D-015, hosted Checkout dependency D-041) and update `plan/STATUS.md` to `Verified` for Z when Claude has run C-Z-1…C-Z-9.
- [ ] Z-07 Report M-Z-1 and M-Z-2 for the owner; set Z to `Ready for review`.

## Unit tests (scenario → test)
No new product behaviour. The reconciliation is verified by `node plan/verify-plan.mjs` (scenario coverage across all workstream tables) and `openspec validate --specs`.

| Scenario | Capability | Test |
| --- | --- | --- |
| (none: plan-level checks) | all | `node plan/verify-plan.mjs` exit 0; `openspec validate --specs` exit 0 |

## Chrome verification (run by Claude)
- C-Z-1 (needs OA-02, OA-03, F–Y verified): New consumer journey, en-US, 1280 px: `/en-US` → "Cable internet" → choose Cable 500 (24-month) → accept the defaulted router → add Spotify → open `/en-US/bundle` → totals show Monthly and One-time fees, Broadband Facts label for Cable 500 → register at `/en-US/register` (auto-verified, signed in) → bundle merged → checkout → pay with the Adyen test card → `/order-confirmation/<number>` shows the reference and "Order placed" state → console has no errors, no failed network calls except expected 4xx probes.
- C-Z-2 (needs OA-05): Phone + financed handset: `/en-US/shop/phone-plans` → Unlimited ×2 lines → `/shop/phones-and-devices` → Nova Pro 256 GB installments 24 months → bundle shows both, "second line $10 off" applied → financing decision approved → pay → confirmation.
- C-Z-3: Conflict and incompatibility: with Cable 500 in the bundle, add Home Wireless Air 5G → blocked with the conflict reason naming Cable 500; add the AC1200 router to Cable Gig → refused with the speed reason; both messages are visible text, not only colour.
- C-Z-4: Eligibility: set postal code 99999 (no service) in checkout address → cable offers show "not available at your address" and Place order is blocked; 97201 → allowed.
- C-Z-5: Account: sign in as the seeded demo customer → `/en-US/account` shows contract rows and labels → open an order → cancel an order before service start → state changes; open a device order → request a return within 30 days.
- C-Z-6: Search: `/en-US/search?q=MLV-CA-500-24` resolves to the Cable 500 listing anchored on the card; `q=router` lists equipment; empty query shows category fallback tiles.
- C-Z-7: de-DE: repeat C-Z-1 on `/de-DE`: all UI strings German, prices in EUR with German formatting, `html lang="de-DE"`.
- C-Z-8: Mobile 375 px: header drawer opens/closes with keyboard (Esc, focus trap), listings single column, bundle summary below lines, forms usable; Lighthouse mobile accessibility ≥ 95.
- C-Z-9 (needs OA-06): Repeat C-Z-1 on the Netlify URL; response headers include the security headers; no mixed content.

## Manual tests (owner only)
- M-Z-1 (needs OA-03): Revoke the seed/admin API client in Merchant Center and confirm `npm run seed` now fails with an authentication error → seeding no longer possible with the old credentials.
- M-Z-2 (needs OA-05, OA-06): Skim `plan/FINAL-REPORT.md` and the Netlify site; approve release or list changes → `APPROVED` in `TODO-MANUAL-TESTING.md`.

## Excluded
The specs `agent-redemption-quota` (D-022), `account-registration-request` (D-005, D-031) and `product-detail-page` (D-052) are intentionally not built; their scenario titles are not tracked by the plan verifier (`NOT_BUILT` in `plan/verify-plan.mjs`).

## Definition of done
- [ ] All tasks ticked; `npm run verify:release` passes from a clean clone.
- [ ] `node plan/verify-plan.mjs` prints OK with 0 uncovered scenarios.
- [ ] C-Z-1…C-Z-9 PASS in `VERIFICATION-LOG.md`; Lighthouse targets met or deviations accepted by the owner.
- [ ] `FINAL-REPORT.md` written; seed client revoked (M-Z-1); STATUS `Verified`.
