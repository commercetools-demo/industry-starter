# Spec coverage

Every requirement of every Malva spec is implemented by the workstream(s) below; `verify-plan.mjs` fails if one is missing. Specs live in `openspec/changes/bootstrap-malva-storefront/specs/` (foundation) and `openspec/changes/malva-website/specs/` (website). The 70+ specs in `openspec/specs/` belong to the manufacturing storefront and are **not** part of this plan.

| Spec | Requirement(s) → workstream |
| --- | --- |
| malva-project-bootstrap | versions, directory layout, secrets, quality gate → A · token and font hooks → B · smoke test → G |
| malva-locale-routing | all → C |
| malva-bff-and-session | client, scopes, session cookie, route handlers, type boundary, health → D · session lifecycle, as-associate chain → F |
| malva-business-unit-context | default store, channel resolution, atomic fields, discovery → F · BU-scoped client state → G |
| malva-data-loading | all → G |
| malva-homepage | global chrome → H · proof content → I · hero/services/audiences/performance → J |
| malva-service-listing | all → K |
| malva-service-detail | detail page, related, metadata → L · add to quote list → P · request a quote for this service → Q |
| malva-about | all → M |
| malva-client-portal | registration, sign-in → N · private, overview, multiple companies → O · quotes and requests → R · sites and team → S · visits, waste documents, invoices → T |
| malva-quote-list | all → P |
| malva-request-a-quote | all → Q |

## Not specified by a spec (work that still needs a home)
| Work | Workstream |
| --- | --- |
| Seed scripts: project settings, catalog, roles, custom types, images, demo company | E |
| Error pages (`error.tsx`, `not-found.tsx`) | H |
| Abuse protection, rate limits, security headers, dependency audit | U |
| Accessibility sweep, performance, SEO audit | V, W, X |
| Deployment | Y |
| Release checklist, sample-content launch check | Z |

## Consciously not built
| Item | Why |
| --- | --- |
| Real email (verification, confirmations, reset links) | Q-003: no provider |
| Online payment, prices, invoices payable online | out of scope (proposal) |
| Region/language switching UI | Q-012: single locale |
| Approval workflows, recurring orders, shopping lists, bundles | not requested |
| Multi-site single request | Q-017 default: one request per site |
