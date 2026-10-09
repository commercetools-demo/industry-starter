# S-06 live check (2026-10-09)

Run on the throwaway company `mpw-test-journey-co-5062` (not the demo company), as its admin, through the site's own API from a browser session.

| Step | Result |
| --- | --- |
| Add a site | 200; the site is listed (and is the default, being the first) |
| Invite a colleague (role `mpw-finance`) | 200; a temporary password is returned once (not recorded here); team lists two members |
| Sign in as the colleague | 200; `/api/auth/me` shows the colleague in the same business unit |
| Remove the colleague | 200; team lists only the admin again |
