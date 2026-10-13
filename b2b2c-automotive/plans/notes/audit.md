<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Dependency audit (workstream X-14, G06)

`npm audit --omit=dev` run on 2026-10-12 in `portal/` and `storefront/` (outputs in `plans/evidence/X/npm-audit-portal.txt` and `npm-audit-storefront.txt`). No critical findings. Both apps show the same two root advisories; every other row of the report is a dependent of them.

| Package | Severity | Advisory | Reached through | Fix available | Decision |
| --- | --- | --- | --- | --- | --- |
| `braces` (via `micromatch`, `fast-glob`, `globby`) | high | GHSA-vfj7-8cjw-p6xm, stack exhaustion on deeply nested brace patterns | `@commercetools/nimbus` -> `@chakra-ui/cli` (a build-time command line tool), portal and storefront | none (`fixAvailable: false`) | Accepted. It is a glob library used by a code generation CLI, never fed request data, and is not part of the server bundle. Re-check when nimbus updates. |
| `uuid` < 11.1.1 | moderate | GHSA-w5hq-g745-h8pq, missing bounds check in v3, v5, v6 when a caller passes a buffer | `@measured/puck` -> `uuid@9.0.1`, inside the Contentools managers | none | Accepted. Puck generates random ids (v4) without a caller buffer; the editors run for signed-in Admins only. Re-check when the `@commercetools-demo/puck-*` packages update. |

The report lists 17 (portal) and 14 (storefront) vulnerabilities because `npm audit` counts every dependent of those two packages (the `@commercetools-demo/puck-*` family, `@commercetools/nimbus`); there is no safe upgrade to apply: `npm audit fix` offers nothing for these two, and forcing the suggested downgrades would break the Contentools managers. No lockfile was changed.

Rerun 2026-10-12 (J25) with no lockfile change since: portal 17 (6 moderate, 11 high), storefront 14 (6 moderate, 8 high), same two root advisories, nothing critical.

Gate G06 ("no high or critical") is therefore met with one documented high exception (`braces`, build-time only). Owner sign-off of the exception: part of M-X-03.
