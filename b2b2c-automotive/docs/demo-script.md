# Malva Automotive — Demo Guide

A commercetools marketplace for vehicle parts. Malva runs the platform; independent resellers each get their own store, branches, prices and theme. Shoppers find parts that fit their vehicle, and resellers manage their store in a seller portal. Two apps: the **storefront** (shoppers) and the **portal** (resellers).

| | |
|---|---|
| **Open** | Storefront [customer-automotive-industry-starter.netlify.app/de-DE/mau-reseller-north](https://customer-automotive-industry-starter.netlify.app/de-DE/mau-reseller-north) · Portal [portal-automotive-industry-starter.netlify.app/de-DE/sign-in](https://portal-automotive-industry-starter.netlify.app/de-DE/sign-in) |
| **Sign in** | Both sign-in pages list demo accounts when demo login is enabled; pick one, no password to type. Shoppers: `anna.schneider@example.com`, `liam.carter@example.com` (US, USD). Portal: `north.admin@example.com` (Admin), `north.buyer@example.com` (Buyer) |
| **Stores** | `mau-reseller-north` (Kuestenwerk) and `mau-reseller-south` (Suedkamm); both apps run in de-DE and en-US |

**Short on time? Go to C** — one reseller changes a price and a theme, and the storefront follows.

## A — A shopper finds parts that fit

| Click this | What it shows |
|---|---|
| ▶ Open the [Kuestenwerk storefront](https://customer-automotive-industry-starter.netlify.app/de-DE/mau-reseller-north) and sign in as **Anna Schneider** | Anna has a saved vehicle in her garage |
| Pick a branch from the store picker (map or list) | Each reseller store has branches (commercetools Channels) with their own stock and price |
| Pick a vehicle in the vehicle finder, then open **Parts** | The listing shows only parts that fit the chosen vehicle |
| Open any part | The product page shows whether the part fits the vehicle |
| Open **Garage** under the account | Saved vehicles stay with the customer |

## B — Cart, checkout and order

| Click this | What it shows |
|---|---|
| ▶ Add any fitting part to the bag and open the cart | Pick-up at a branch is chosen in the cart |
| Open **Checkout** and pay with a Stripe test card | Payment runs in the hosted commercetools Checkout with the Stripe connector |
| Read the confirmation page | The order number on screen is the order's number; no e-mail is sent anywhere in this demo |
| Open the account's **Orders** | The order lists under the shopper; a delivered order within 30 days can start a return |

## C — A reseller manages the store

| Click this | What it shows |
|---|---|
| ▶ Open the [portal](https://portal-automotive-industry-starter.netlify.app/de-DE/sign-in) and sign in as **Admin** (`north.admin@example.com`) | The dashboard for Kuestenwerk, with every navigation item |
| Open **Catalog → Prices** and set a price above zero on a part | The storefront shows the new price. Zero and negative prices are refused |
| Open **Catalog → Product info** and publish tailored text | The reseller's own wording replaces the shared description in its store only |
| Open **Store → Theme** and change a colour or font | Storefront A takes the theme; store B keeps the default |
| Open **Store → Channels** and edit a branch | Branch stock and price show in the storefront picker and product page |

## D — Discounts, bundles and import

| Click this | What it shows |
|---|---|
| ▶ In the portal as Admin, open **Catalog → Product discounts** or **Cart discounts** | Create a discount and set its priority; the storefront cart shows it by name. Malva's discount applies before the reseller's |
| Open **Bundles**, create and publish one | The storefront adds the bundle as a parent line with child lines |
| Open **Import** and upload a CSV | Preview first; valid rows are created in this reseller's own selection, invalid rows are listed with a reason |

## E — Subscriptions, returns and reviews

| Click this | What it shows |
|---|---|
| ▶ On a part with a recurrence policy, choose **Subscribe and save**, then complete checkout | A recurring order the shopper manages in **Subscriptions**: pause, resume, skip, change interval |
| In the portal open **Subscriptions** | The same subscription, with state changes visible in both apps |
| In the portal open **Returns** | The reseller records receipt, inspects and refunds; the refund stays pending until the payment connector confirms it |
| Post a review on a part you bought, then reply in the portal's **Reviews** | Reviews from verified buyers appear at once with the reseller's reply |

## F — Roles, shopping as a customer, isolation

| Click this | What it shows |
|---|---|
| ▶ Sign in to the portal as **Buyer** (`north.buyer@example.com`) | Fewer navigation items; Admin routes return a forbidden page |
| As Admin open **Customers**, pick one, choose **Shop as customer** | The storefront opens with a banner; account changes are refused and personal data is masked; the session ends after 2 idle minutes. Buyers cannot start it |
| Sign in as `south.admin@example.com` and try store A's data | Store B's admin cannot read or change store A's resources |

## What's real

| Feature | What runs, and where it stops |
|---|---|
| Stores, branches, selections, standalone prices, discounts | Real commercetools data on project `spec-test-b2b2c-automotive`; parts, prices and stock are generated seed data |
| Vehicle fit | Parts carry fitment attributes; vehicles are a seeded set |
| Payment | Hosted commercetools Checkout with a Stripe test account; test cards only |
| Subscriptions, returns, reviews | Recurring orders, order return data and reviews are stored in commercetools; refunds depend on the connector confirming |
| Marketing, e-mail, brand partnership | Campaigns and templates are stored and previewed; nothing is sent |
| Demo sign-in | Available only while demo login is enabled; absent in production builds |

**Not built:** wholesale stores and MAP price floors are out of scope; the portal has Admin and Buyer roles only.

## How it's built

See the Malva Automotive how-it-works document.
