# Evidence: workstream J (auth and session)

Run against `storefront/scripts/mock-ct-server.mjs` (extended with login and customers), not a live project: no credentials were available.

- `browser-checks.txt`: what each browser step showed (B1, B4, B5, B7, B8, B9, demo sign-in with bag merge, logout, log grep with 0 matches).
- `B1-sign-in-demo-1440.png`: sign-in page with the demo customers box (guest bag shows 3 in the header).
- `B5-register-weak-500.png`: register page, weak password, unmet rules shown with icon and text (Chrome minimum window width is 500 px).

Not here because they need live commercetools: J-09 probes, seeded-customer verification (`seeded-customers.json`), reading the registered customer back. See `plans/notes/todo-J.md` (OA-J-a, OA-J-c).
