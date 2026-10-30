# Malva Telecom — Demo Guide

A commercetools storefront for Malva Telecom, a consumer carrier selling cable internet, wireless internet, phone plans, add-ons, equipment and handsets in the US (USD) and Germany (EUR). The basket is called **My bundle**.

| | |
|---|---|
| **Open** | [telecom-b2c-industry-starter.netlify.app](https://telecom-b2c-industry-starter.netlify.app/en-US) |
| **Sign in** | No shared login. Open `/en-US/register`, create an account (it is verified immediately; no email is sent) and you land in your account. |

**Short on time? Go to B** — add-ons and equipment that follow the plan, and the rules that block what does not fit.

## A — Browse the catalog

| Click this | What it shows |
|---|---|
| ▶ Open `/en-US` and choose a category from the header | Category listings live under `/shop/<category>`. A listing card is an **offer**: the sellable wrapper commercetools prices, and the price shown is the offer's master variant |
| Filter an internet listing by speed | Speed chips are bands on downstream speed: "Up to 500 Mbps" is 500 or less, "1 Gbps" is above 500 |
| Filter the phone listing by **Unlimited** or data-capped | Unlimited is a data value of -1 on the plan; the filter reads the attribute |
| Open the search page from the header magnifier and search a plan name, then a SKU | Search runs on the commercetools Product Search API; a SKU query is matched on the article number |
| Switch the language to German | Routes, copy, currency and country switch together to `/de-DE` and EUR |

## B — Plans, add-ons and equipment that depend on each other

| Click this | What it shows |
|---|---|
| ▶ Add any internet plan to **My bundle** from `/en-US` | A required router is added with it as its own line, defaulted to the cheapest compatible one; you can change it |
| Open **My bundle** | Add-on and equipment lines are linked to the plan line they belong to |
| Remove the plan | You are asked to confirm, because its dependent lines leave with it |
| Try to add an add-on or equipment item that is not compatible with the plan in the bundle | The add is refused with a notice. Compatibility and conflicts are evaluated on the server by one rules module |
| Add a phone plan and raise the quantity | A phone plan is sold per line; quantity is the number of lines, up to 5 |
| Add a plan that has a bundling pairing, then look for the prompt | A prompt suggests adding a line that would activate a discount. It only suggests an addition; the discount is a Cart Discount re-priced on every read of the bundle |

## C — Eligibility and service address

| Click this | What it shows |
|---|---|
| ▶ Open `/en-US/plan-finder` | Offers are filtered by what is available at an address |
| Enter ZIP `60601` | The three wireless plans are hidden |
| Enter ZIP `99999` | Every offer is hidden as not served |
| Enter ZIP `59001` | Only mobile-only offers remain; internet plans, equipment and internet-only add-ons are hidden |

> Serviceability is a built-in table of ZIP codes behind an interface. It does not call a carrier coverage system.

## D — Recurring prices and the Broadband Facts label

| Click this | What it shows |
|---|---|
| ▶ Add a plan with a contract term to **My bundle** and open it | Every monthly line carries a recurring price tied to a monthly Recurrence Policy; one-time items such as activation fees are priced separately |
| Look for the Broadband Facts label on the plan | The label shows price, term and early-termination figures computed from the offer |
| Add a plan that has an introductory period | The introductory price schedule shows alongside the regular price. The schedule is stored on the order |

## E — Handsets and how to acquire them

| Click this | What it shows |
|---|---|
| ▶ Open a handset from the devices listing | One product and one SKU per colour and memory |
| Choose **outright**, **installments** (12, 24 or 36 months) or **lease** | The acquisition mode and term are saved as custom fields on the bundle line; financed and leased lines carry a recurring price |
| Add an installments line while signed out, then try to check out | A credit decision needs an account. Signed in, the decision is returned as approved or declined with a reason |

> The credit decision is a deterministic stand-in, not a credit bureau.

## F — Checkout and the order

| Click this | What it shows |
|---|---|
| ▶ Sign in, fill **My bundle** with any plan, and choose **Check out** | Guests are offered sign-in or guest checkout; sign-in merges the anonymous bundle into your account's |
| Step through contact, address and delivery | Digital-only bundles skip delivery. A minimum order value ($30 / €28) applies |
| Pay | Payment runs through commercetools Checkout in payment-only mode |
| Open the confirmation page | The order is created with the plan's recurring schedule |

## G — Account, cancel and return

| Click this | What it shows |
|---|---|
| ▶ Open `/en-US/account` signed in | Dashboard, orders, addresses, payment methods and saved lists |
| Open **orders**, then an order with a start date in the future | An order can be cancelled online only before its service-start date; the reason is recorded |
| Open an order with a handset | A return request is available within 30 days of the order |
| Open **payment methods** | Saved methods can be listed, set as default and removed |
| Open `/en-US/forgot-password` and request a reset | The reset link appears on screen under a demo-mode banner |

## What's real

| Feature | What runs for real, and where it stops |
|---|---|
| Catalog, offers, prices, search | Products, Recurrence Policies, Cart Discounts and Product Search in a commercetools project · prices and plan names are illustrative |
| Bundle rules | Compatibility, conflicts and required equipment evaluated server-side · no commercetools API Extension |
| Serviceability | Seeded ZIP table, not a coverage system |
| Credit decision | Deterministic stand-in |
| Checkout | commercetools Checkout, payment-only · payments run in test mode |
| Accounts | commercetools customers, sessions server-side · registration is auto-verified and no email is sent |
| Tax | A placeholder 0% rate per country |
| Content | About, FAQ, blog and policy pages are static files; contact is a `mailto:` link |

**Not built:** agent mode, online plan changes, B2B features.

## If something looks off

| What you see | Why |
|---|---|
| A product image is missing | Images are hotlinked; a token-coloured placeholder shows when none is available |
| A new offer takes minutes to appear in search | The Product Search index updates after a change |

## How it's built

See the *Malva Telecom — How it works* Doc.
