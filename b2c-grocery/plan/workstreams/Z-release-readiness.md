# Z — Release readiness and final verification

**Specs:** all three changes; this workstream proves they are implemented.
**Depends on:** A–Y · **Unblocks:** archive of the OpenSpec changes · **Owner prerequisites:** all OA-* done; all SO-* approved

## Goal
Everything is verified against the specs, manual tests are executed by the owner, secrets and temporary credentials are cleaned up, and the OpenSpec changes can be archived.

## Tasks
- [x] Z-01 **Spec coverage run:** for every `#### Scenario` in the three changes, confirm a test exists (use the "Unit tests (scenario → test)" tables in the workstream files). Produce `plan/COVERAGE-REPORT.md` listing each scenario → test file(s); any gap becomes a fix task before continuing.
- [x] Z-02 Run `cd site && rm -rf node_modules .next && npm ci && npm run verify:release`; paste the pass summary (no secrets) in `plan/COVERAGE-REPORT.md`.
- [x] Z-03 Run `npm run seed:verify` and re-check `PROJECT-FINDINGS.md` is current.
- [x] Z-04 Consolidate the manual tests: every `M-*` row in the TODO file has a status set by the owner; list `FAIL` rows with notes and fix them (new tasks).
- [ ] Z-05 Security hygiene: delete/disable the **seed/admin API client** (OA-03) and the throw-away local credentials; confirm `git log -p` contains no secrets (`git log -p | grep -iE "client_secret|session_secret"` finds only variable names); confirm Netlify env vars are the only copies in production.
- [x] Z-06 Update `openspec/changes/*/tasks.md` checkboxes to match reality; run `openspec validate <change> --strict` for the three changes; then ask the owner whether to archive (`/opsx:archive`) — do not archive yourself.
- [x] Z-07 Write `site/README.md` final sections: architecture overview (BFF flow diagram in text), how to add a country/page/API (links to the skill references), known limitations (stub slots reset on cold start; no email sending; D-042; reviews placeholder; recurring orders beta).

## Definition of done (project)
Z-01…Z-07 ticked; `STATUS.md` all `Verified`; owner sign-off recorded in `plan/DECISIONS.md` as D-099 ("v1 accepted").
