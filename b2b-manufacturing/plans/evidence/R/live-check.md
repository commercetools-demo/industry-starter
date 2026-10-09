# R-06 live check (2026-10-09)

Test company `mpw-test-journey-co-5062`, request reference MQ-T4R6TZ.

| Step | Actor | Result |
| --- | --- | --- |
| Quote request submitted from the site | visitor, browser | Quote Request `Submitted` |
| Staged quote created from the request (`quoteRequestStateToAccepted`) | seller, MCP | Request `Accepted`, Staged Quote `InProgress` |
| Quote created from the staged quote, sent | seller, MCP | Staged Quote `Sent`, Quote `Pending`; portal shows "Quote ready" |
| Accept in the portal ("Accept quote", then "Yes, accept") | client, browser | Page shows "Accepted" and "Quote accepted. Thank you." |

Screenshots: `quote-pending.png`, `quote-accepted.png`. No console errors or failed requests.
