# Ideas parked for later

Park anything outside your workstream here (JUNIOR-GUIDE §1.5). One line each: idea · why · who noticed.

- Real email provider through a Connect connector (verification, confirmations, reset links) · replaces the on-screen token flow · plan
- Playwright end-to-end smoke suite in CI · repeatable browser checks without the Chrome connector · plan
- Contract/site-specific service sets via per-company Stores and Product Selections · only if pricing or catalogs diverge · plan
- Service-level statistics from real data (response time, diversion rate) on the homepage · replaces sample figures · plan
- Multi-site single request using `shippingMode: Multiple` (not allowed for Quote Requests) → separate requests per site is the interim · plan
- Upgrade `@commercetools/platform-sdk` to 9.x and `ts-client` to 5.x · follow-up change after the pinned majors prove stable · plan

## Site-scoped team access (from workstream S)
The "Invite a user" scenario says a Site contact sees only their sites' data. v1 has no Business Unit Divisions, so site-scoped visibility is not enforced and the invite form has no site picker: every associate sees the whole company. Idea: model each site as a Division and assign associates per division (the as-associate chain and inheritance already support it), then filter the portal lists by the user's divisions.

## Pagination of portal lists
Portal lists load up to 100 rows with no paging (quotes, sites, team, visits, documents, invoices). Add offset paging when a client has more.

- **Removed colleagues keep their customer record.** Removing a team member drops the association only (found in S-06); the customer can still sign in but sees no company. Consider deactivating or deleting the customer when they belong to no other unit.
