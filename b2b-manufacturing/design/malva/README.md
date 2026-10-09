# design/malva

Design artifacts imported from two Claude Design projects:

- **Malva plumbing website design** (`d31829dd-8009-4a41-bf37-9fd3d8c6cec4`) — `Malva.html`, `colors_and_type.css`
- **Store Launchpad — B2B Manufacturing Design System** (`6e1ae35d-1b59-4f01-a63f-9ae939e21423`) — token and pattern source; Malva reuses its tokens unchanged

Files:

- `DESIGN.md` — tokens, layout, components, content rules, design gaps
- `PLAN.md` — phases, open decisions, mapping to `openspec/changes/malva-website/`
- `specs/` — `homepage.md`, `plp.md`, `pdp.md`, `cart.md`, `checkout.md`, `account.md`
- `source/` — raw imports: `Malva.html`, `colors_and_type.css`, `design-system-README.md` (condensed)

`source/` is reference only. Fonts (`Inter_18pt/28pt` TTFs) were **not** copied (binary; the DesignSync tool returns text). Fetch them from the Claude Design project or from Inter's release before building. Re-import when the design changes.

Behaviour requirements live in `../../openspec/changes/malva-website/`.
