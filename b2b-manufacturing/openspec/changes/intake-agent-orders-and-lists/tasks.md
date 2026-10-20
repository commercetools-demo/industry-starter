## 1. Spike and scopes

- [ ] 1.1 Call Intake once with a real token (text + one file, each output type) and capture status, duration and the success body shapes; record the host's function duration limit and whether `after()` runs after the response on this runtime; settle D1 fallback and `INTAKE_STALE_MS` [SKILL: commercetools-platform]
- [x] 1.2 Add `manage_intake_agent` (and any scopes found in 1.1, e.g. shopping lists) to `lib/scopes.ts`, update `lib/scopes.test.ts` and `.env.example` [SKILL: commercetools-platform]

## 2. Server

- [x] 2.1 `lib/ct/intake.ts`: token fetch with cache, raw `fetch` for JSON and multipart, response and error mapping, zod schemas; unit tests with a mocked `fetch` [SKILL: commercetools-platform]
- [x] 2.2 `lib/ct/intake-records.ts`: create/update/list Custom Objects in `mpw-intake` (key `<bu>.<id>`, newest 50, versioned update, stale-as-failed on read); tests [SKILL: commercetools-platform]
- [x] 2.3 Validation: file count, type, size, shopping-list name, nothing-to-submit (shared by form and server) 
- [x] 2.4 `app/api/intake/route.ts`: POST (auth, rate limit, validate, build prompt from session, write `processing`, answer 202, run Intake in the background, write result) and GET (list); tests for 401, validation, success, Intake error, session-only identity [SKILL: commercetools-platform]

## 3. UI

- [x] 3.1 `IntakeButton` in `TopBar` and `MobileMenu` (signed-in only), `ROUTES.intake`, portal nav entry, messages in all locales; shell tests
- [x] 3.2 `/account/intake` page: output toggle, conditional list-name field, multi-file picker with limits, free text, submit then redirect to list
- [x] 3.3 Intake list component with SWR polling while any row is `processing`, status/entity/warnings/error display, empty state, read-only rows; component tests

## 4. Verify

- [ ] 4.1 Run lint, typecheck and tests; exercise the flow in the browser against the project for Cart, Shopping list and Quote request, including a failing input
