<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Owner items: workstream W (customer connector)

Draft for the lead to merge into `TODO-MANUAL-TESTING.md`. No value goes into chat or git.

| ID | Who | When needed | Steps | Expected result | Status |
| --- | --- | --- | --- | --- | --- |
| OA-W-a | Owner | Before W-13 (everything else runs with mocks) | 1. In Merchant Center open Settings, Developer settings, Create new API client. 2. Tick only Orders: View, Shopping lists: View, Customers: Manage and Types: View. 3. Put the client id, secret, scope list, project key, auth URL and API URL into `b2c-foodservice/connect/customer-api/.env` as `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPE`, `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`. Never paste the values into chat or git. | `npm run start:dev` serves real data for a demo customer | TODO |
| OA-W-b | Owner | After W-13, before any deploy | 1. Create a private GitHub repository for the connector. 2. From `industry-starter`: `git subtree split --prefix b2c-foodservice/connect -b connect-export`, push that branch to the new repository as `main`, tag it `v0.1.0`. 3. In Merchant Center, Connect, create a Connector from that repository and tag (region `us-central1.gcp`), or `commercetools connect connectorstaged create`. | The ConnectorStaged shows the `customer-api` application and no validation errors | TODO |
| OA-W-c | Owner | After OA-W-b | Deploy the connector to project `spec-test-b2c-food` as a **sandbox** deployment (`commercetools connect deployment create --type sandbox --region us-central1.gcp`). Note the service URL Connect reports; it already ends in `/customers` (`{connect-url}/{endpoint}`). | `GET <url>/health` answers `{"status":"ok"}` | TODO |
| OA-W-d | Owner | Before OA-W-b | With Docker running, from `b2c-foodservice/connect`: `commercetools connect validate`, then `commercetools connect application test` in `customer-api`. | Both pass (the CLI's own check of `connect.yaml` and the app) | TODO |
| M-W-01 | Owner | After OA-W-c | From the frontend that will use it, call `<url>/<demo customer id>/orders` (`<url>` is the OA-W-c URL, which ends in `/customers`), add a note, edit it, delete it, and read the loyalty points. | All calls work from the browser with no CORS error | TODO |
