<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Questions: workstream P (content and error pages)

Draft for the lead to consolidate into `QUESTIONS.md`.

| ID | Question | Default | Blocks? | Status |
| --- | --- | --- | --- | --- |
| Q-P-1 | Where does page content live (the templates say CMS, edits published without a deployment)? | Repository content modules behind one seam (`lib/content`); a correction needs a deploy. The About scenario "without a storefront deployment" is recorded as partial | no | Open |
| Q-P-2 | Routes and slugs of the content pages | `/about`, `/contact`, `/faq`, `/policies/{shipping-returns,terms,privacy,accessibility}`, `/journal`, `/journal/{slug}` | no | Open |
| Q-P-3 | Where do contact enquiries go and who answers them? | A webhook receiver chosen by the owner (OA-P1); until then the form reports "not sent" honestly (503) | live contact only | Open |
| Q-P-4 | Rate limiting is per server instance on serverless hosting | J's shared in-memory limiter now (5 per 10 minutes per client); shared store or host WAF decided in Q's security review | no | Open |
| Q-P-5 | Does a signed-in shopper's enquiry carry the customer id? | No; only a prefilled name and email the shopper can edit | no | Open |
| Q-P-6 | Cookie or consent banner, and a chat widget? | Neither (no third-party scripts, no analytics); SO-P4 asks the owner and legal | release | Open |
| Q-P-7 | Who owns FAQ "unhelpful" votes? | The server log is the collector until the owner names a receiver and an owner of record | no | Open |
| Q-P-8 | Which statements on About are legally controlled (certifications, sourcing, recycling)? | None claimed; the owner adds claims with sign-off | release | Open |
| Q-P-9 | Removed (D-030): no German seller, so no imprint page | None | no | Answered |
| Q-P-10 | Do policies differ by market, or only by language? | By language only (en-US and en-CA share the English text) | release | Open |
| Q-P-11 | Re-consent for subscribers after a material change of terms? | Not built, out of scope | no | Open |
| Q-P-12 | A retired product linked from an old bookmark or page: hard 404 or soft redirect to its category? | Hard 404 page with search and category links | no | Open |
| Q-P-13 | Name of the blog section | "Journal" at `/journal` | no | Open |
| Q-P-14 | Where are superseded policy versions kept so the text in force on an order date can be produced? | Git history; no public archive page | no | Open |
| Q-P-15 | The footer newsletter (design-storefront-shell) needs a receiver and a route that is not in the route table | F made it a validated no-op (Q-F-07); not built in P | no | Open |
