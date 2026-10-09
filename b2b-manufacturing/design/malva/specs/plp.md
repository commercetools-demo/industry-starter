# Product listing page (PLP) — design spec

PLP = the **service listings**: Plumbing (`#plumbing`, 5 services) and Waste management (`#waste`, 7 services).
Source: `Malva.html`. Behaviour: `openspec/changes/malva-website/specs/malva-service-listing/spec.md`. Foundations: `../DESIGN.md`.

## Layout

1. **Page header** (muted wash) — breadcrumb `Home / Plumbing`, H1 "Plumbing services", lead "Reliable water and drainage engineering for commercial and industrial sites." Waste: H1 "Waste management services", lead "Collection, recycling and compliant disposal across every waste stream on your site."
2. **Grid** — 3 columns, gap 24px. Card = photo (200px) · mono index `01`… · H3 name · 15px description · "Learn more →". Whole card is a link. 5 cards (plumbing), 7 cards (waste).
3. **Supporting band**
   - Plumbing (wash): left photo "CCTV drain survey", right H2 "How planned maintenance works" + 4 checks (survey and asset register within 10 working days; fixed inspection schedule; emergency callout 4-hour response; digital visit reports in the portal).
   - Waste (dark): H2 "Compliance, documented", lead "Every collection is tracked from your site to final disposal.", two lists of 3 checks.
4. **CTA band** — plumbing "Need a survey or planned maintenance contract?"; waste "Ready to review your waste contract?".

## Service copy (verbatim from the design)

| Service | Description |
| --- | --- |
| Pipe installation & repair | Mains, process and distribution pipework in steel, copper and PE. Planned shutdown works with isolation plans. |
| Drain cleaning & CCTV survey | High-pressure jetting and recorded CCTV surveys with condition-graded reports. |
| Backflow & water testing | Backflow preventer testing, legionella risk assessments and water-quality sampling. |
| Boiler & hot water | Commercial boilers, calorifiers and hot water systems — service, repair, replacement. |
| Commercial fit-outs | First and second-fix plumbing for offices, plants, wards and retail units. |
| General waste collection | Scheduled pickups sized to site volume, with bin and compactor options. |
| Recycling | Segregated streams for cardboard, plastics, metals and glass with monthly rate reporting. |
| Hazardous waste | Licensed collection of oils, solvents, chemicals and batteries with consignment notes. |
| Grease trap servicing | Scheduled emptying and cleaning for kitchens and food production. |
| Medical / clinical waste | Segregated, tracked collection for clinics, labs and care facilities. |
| Liquid waste & tankering | Tanker collection of process effluent, sludge and interceptor contents. |
| Compliance reporting | Waste transfer notes, audit trails and annual reports in one portal. |

## Interactions

- Card click → service detail (PDP). In the prototype it goes to the quote form; the PDP replaces that.
- Hover: card shadow `--shadow-hover`, no underline.
- **No filters, sort or pagination** are designed — 5 / 7 items fit one page. Proposed lightweight addition: an optional sector chip row (Facilities · Manufacturing · Property · Healthcare) that filters the grid via `?sector=`, hidden while it would add nothing.

## States

Empty (a category with no published services): header stays, body states "No services are listed here yet." with a **Request a quote** button. Loading: skeleton cards of equal height. Error: inline retry card.

## Gaps vs. design

- Detail destination missing (see `pdp.md`).
- Services that cross both categories (Compliance reporting needs plumbing records too) have no cross-link.
- Images are placeholders; one per service is required (12).

## Acceptance

1. Plumbing lists exactly the 5 and waste exactly the 7 services in the order above.
2. Cards are one focusable link each with the service name as accessible name; the index number is `aria-hidden`.
3. Breadcrumb exposes `aria-current="page"` on the last item.
4. Page is cacheable with no per-user data.
