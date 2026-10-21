# Evidence: workstream N (subscriptions)

Everything here was produced **offline**: no live project exists in this session (OA-02, OA-04 not done) and the Chrome DevTools MCP was held by another session ("browser already running for the profile"), so there are **no screenshots**. The browser recipe (section 6 of the workstream file) is recorded as owner/next-session rows M-N-05 and M-N-06 in `plans/notes/todo-N.md`.

| File | What it proves |
| --- | --- |
| `paths.md` | N-00: the real names and paths of the files N builds on. |
| `spike.md` | N-02: what the documentation says about recurring orders, what is UNKNOWN until a live run, and the defaults built. |
| `api-run-mock.md` | The whole storefront chain (session, `POST /api/cart/lines` subscribe, place order, `GET/PUT /api/recurring-orders`) driven over HTTP against `scripts/mock-ct-server.mjs` with the recurring-orders mock (`scripts/mock-fixtures/mock-recurring.mjs`). Behaviour of the mock is the documented behaviour, not measured platform behaviour. |
| `test-data.md` | Which test data a live run creates (none yet). |

Unit and component tests (named after the scenarios) are listed in the Scenarios checklist of `plans/workstreams/N-subscriptions.md`.
