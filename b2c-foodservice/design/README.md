# Malva Coffee: design

Source: the VELA Storefront Claude Design project (`c7cfe639-1d97-4577-aeac-1cb662ea1acb`), received as a handoff zip on 2026-10-19. The design sync tool could not read it directly: the organization's zero data retention policy returns HTTP 403 for Claude Design connections. The owner downloaded the handoff bundle from claude.ai/design in a browser instead.

## What is stored

`export/b2b2c-retailer-design/` holds the unzipped bundle, unmodified:

| Path | What it is |
| --- | --- |
| `README.md` | Handoff note from Claude Design |
| `project/VELA Storefront.html` | Prototype entry point; loads the `app/` scripts in order |
| `project/VELA Storefront (standalone).html` | Single-file bundled version of the same prototype |
| `project/CLAUDE.md`, `project/B2B-addons.md` | Prototype notes: file map, conventions, commercetools mapping, B2B behaviour |
| `project/app/` | JSX pages and components, `styles.css`, `colors_and_type.css` |
| `project/_ds/presales-design-system-wip-*/` | Design system README, manifest, bundle, tokens, oxlint adherence config |
| `project/screenshots/`, `project/uploads/` | Review screenshots and the reference screenshots the designer started from |

VELA is a fictional activewear brand. Malva Coffee reuses its structure and tokens; product imagery, copy, categories, facets and variant model are replaced (see the mapping in `../openspec/changes/b2c-foodservice-design/design.md`).

To view the prototype, serve `export/b2b2c-retailer-design/project/` over HTTP and open `VELA Storefront.html` (it loads React and Babel from unpkg).

## Specs

Design specs are flat `design-*` capabilities in `../openspec/specs/` (the OpenSpec CLI only discovers one directory level). Plan and decisions: `../openspec/changes/b2c-foodservice-design/` (`proposal.md`, `design.md`, `tasks.md`).
