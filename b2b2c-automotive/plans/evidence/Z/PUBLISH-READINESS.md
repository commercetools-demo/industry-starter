<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# ct-builders readiness (internal evidence, must not ship)

Status: PARTIAL, written by J28 (2026-10-12). The `ct-builders-readiness` sweep (`sweep.py`, `derive_terms.py`) has not been run yet: it needs `gh` and the owner's answers in M-Z-01, M-Z-02 and M-Z-07.

**Verdict line: gate 0 not applicable (stays in labs, owner 2026-10-12).** No overall verdict is given: judgement items are open, so this report never says "publishable".

| Gate | Result so far |
| --- | --- |
| 0 Roadmap overlap | **Not applicable (stays in labs, owner 2026-10-12, Q-Z01 / D-049).** The project is not proposed for ct-builders, so no roadmap-overlap decision is sought. For information only, the shapes the skill would flag: a Next.js storefront, a Contentools page builder embed, portal screens that mirror Merchant Center, seed tooling. Owner confirmation: M-Z-01. |
| 1 MIT and SPDX header | Not run. Markdown files carry the HTML-comment header; new `.mjs` and `.ts` files of workstream Z carry the SPDX line. `apply_fixes.py` dry run pending, apply only after the owner's go (M-Z-01). |
| 1b Files not ours | Open: `design/export/` was produced by a design tool and has no licence; default excluded from a published tree, no headers added (M-Z-01). |
| 2 "Unsupported" said out loud | Not run (`SUPPORT.md`, README banner, `CONTRIBUTING.md` come with the apply step). |
| 3 Credentials | Not swept. Offline evidence: `check-secrets` and `check-bundle-secrets` pass in both apps (`plans/evidence/Z/clean-clone.md`); only `.env.example` files hold names; no `.env.local` exists in this checkout. |
| 4 Customer and internal information | Not swept. Expect hits for `Hartmann`, `Lindner`, `Autoline` in specs and the design export and `/Users/...` paths in specs and design notes (D5, D6). |
| 5 Internal tooling | `.claude/`, `CLAUDE.md`, `plans/`, `openspec/` are excluded from any published tree (D6). |
| 6 History | Open: owner states public or private and whether history may be exposed (M-Z-02); default is a fresh single-commit export. |
| 7 Proves it builds | Offline gates pass on a scratch copy (`plans/release-gates.mjs`); a `git clone --no-hardlinks` run with `npm ci` and the public-registry check of the `@commercetools-demo/puck-*` packages are still to do on the release commit. |
| Shared change-set | Not listed yet; rewrite only if the destination changes (not by default). |

Next steps: owner answers M-Z-01, M-Z-02, M-Z-07; then Claude runs `python3 ~/.claude/skills/ct-builders-readiness/scripts/derive_terms.py` and `sweep.py` (commands in `plans/workstreams/Z-release-readiness.md`, Z-09), writes `sweep.json`, triages candidates and completes this table.
