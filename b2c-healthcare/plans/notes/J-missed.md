# Workstream J: gaps noticed in the plan

- No "Sign out" control exists anywhere until the account area (R): `useAuth().signOut()` is built and tested, nothing renders it. R must add the button.
- `/account` (the default post-sign-in destination) is not built until R; sign-in lands on a 404 until then.
- The browser recipe says "lands on `/account` (placeholder until R)"; no placeholder was created (route clash risk, J-questions 10).
- I-04 and J-09 both describe `app/[locale]/(protected)/layout`; expect a merge conflict (J-questions 11). O (cart), N (prescriptions) and Q (checkout) pages must live under `(protected)` to be guarded; the home/doctor pages stay outside.
- The session cookie lives 30 days and is stateless: signing out or changing the password does not revoke other browsers' cookies. There is no server-side session store to revoke.
- Sign-in has no CSRF token beyond SameSite=Lax; login CSRF is low risk here but not zero.
- `account-sign-in` scenario "Credentials accepted" promises the most recently modified active cart comes back; that rests on the platform's `login` behaviour and is only asserted against the mocked response (live step 6).
- Email verification of an address change (`changeEmail` de-verifies) is not part of any J task; R's profile edit must not call it.
- Rate limit buckets reuse the `recordFailedLookup` name and the `rl-` key prefix of F; they accumulate in `malva-ratelimit` with no purge.
- Registration collects no date of birth or consent text; legal copy for sign-up (terms, privacy) is owner/V territory.
