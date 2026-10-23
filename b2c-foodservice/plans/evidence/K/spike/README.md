# K-01 spike evidence

No live run was possible (no credentials, no Checkout Application; OA-04 and OA-K-a open). The finding is in `plans/PROJECT-FINDINGS.md` section F-K-01 and rests on documentation only; every unproven item is UNKNOWN or `blocked: OA-K-a`.

- `storefront/scripts/spike-k.mts`: probe script (S1 to S3 and S5 implemented, the rest print UNKNOWN or `blocked`). Not run. Run `node --env-file=.env.local --experimental-strip-types scripts/spike-k.mts` once credentials exist and save the output (ids only) here as `run-<date>.txt`.
