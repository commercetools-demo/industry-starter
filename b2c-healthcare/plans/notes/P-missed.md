# Workstream P: gaps noticed in the plan

- The three plan statements about removing the default address disagree (see P-questions 1); the spec was followed.
- The state/ZIP table is approximate on purpose (some ZIP prefixes cross state lines, e.g. 733xx is Texas but listed under Oklahoma); it can only produce an overridable warning.
- No billing address handling: orders only need a shipping address; `defaultBillingAddressId` is never set or read.
- Address data (street, phone, name) is patient personal data but not a health-data field; routes and logs never print it (the sanitised-error tests check this). It is stored on the commercetools Customer only.
- The address cache key is cleared at sign-out, but a name change does not rewrite the saved addresses' names (they are independent records).
- Checkout (Q) has no address card yet; the prefill contract is `useAddresses().defaultAddress`.
- A customer's address count is not limited by the app (the platform limit is large); a very long list has no pagination.
- Browser check not done (no credentials, no fixture session): covered by component tests with a stubbed server.
