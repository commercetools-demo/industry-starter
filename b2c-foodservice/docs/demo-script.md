# Malva Coffee — Demo Guide

A commercetools storefront for Malva Coffee, an online coffee retailer selling capsules, beans, machines, accessories and gifts in the US (USD) and Canada (CAD), with six New York stores for collection.

| | |
|---|---|
| **Open** | [omni-industry-starter.netlify.app](https://omni-industry-starter.netlify.app/en-US) |
| **In-store app** | [instore--omni-industry-starter.netlify.app](https://instore--omni-industry-starter.netlify.app/en-US) |
| **Gate password** | `malva-coffee-994` — the first screen also asks for a work email, which is only used to record who visited |
| **Sign in** | [Sign in](https://omni-industry-starter.netlify.app/en-US/account/sign-in), then pick a name from the **demo sign-in** list below the sign-in box |

**Short on time? Go to C** — one bag holding a line that ships, a line collected from a store and a subscription, each with its own promise and price.

## A — Browse

| Click this | What it shows |
|---|---|
| ▶ Open the [Home page](https://omni-industry-starter.netlify.app/en-US) | US market, USD |
| Look at the top strip | **Free shipping over $75.00 · Free café collection, ready in 30 min · 30-day returns.** The free-shipping threshold is read from the shipping configuration |
| Hover **Coffee Beans** in the header | A mega menu built from the commercetools category tree, which a merchandiser edits in the Merchant Center |
| Open [Pods](https://omni-industry-starter.netlify.app/en-US/category/pods) and apply an **Intensity** filter, then a **Roast** filter | Facet counts update against the other active filters. The URL carries the filters, so a copied link reproduces the view |
| Look at any pod card | The price and a computed per-capsule price, so a 10-pack and a 100-box compare on the same basis |
| Open [search](https://omni-industry-starter.netlify.app/en-US/search?q=espresso) | Results and facets from the commercetools Product Search API ([reference](https://docs.commercetools.com/api/projects/products-search)) |

## B — Product page

| Click this | What it shows |
|---|---|
| ▶ Open [Alba Mug](https://omni-industry-starter.netlify.app/en-US/p/alba-mug/MCF-POD-ALBA-10) | A pod product with a **Collect**, a **Ship** and a **Subscribe** way to buy |
| Switch between the pack sizes | Variants of one product, each with its own price and per-capsule price |
| Click the store pill and choose a New York store | The pill reads **Collect at …** and the choice holds across pages |
| Look at the **Collect** card | **In stock at** the chosen store, with a readiness time. Stock is read per store through inventory entries with a supply channel per store ([reference](https://docs.commercetools.com/api/projects/inventory)) |
| Open a machine such as [Barista Compact](https://omni-industry-starter.netlify.app/en-US/p/barista-compact/MCF-MAC-B2C2-BLA-M) | Machines offer **Ship** only; there is no **Subscribe** option |
| *(no click)* | **Subscribe** appears only on products flagged subscribable: pods and coffee |

## C — One bag, three ways to receive it

| Click this | What it shows |
|---|---|
| ▶ [Sign in](https://omni-industry-starter.netlify.app/en-US/account/sign-in) as **Maya Okonkwo** | A US shopper. Choose a New York store as in B |
| On [Barista Compact](https://omni-industry-starter.netlify.app/en-US/p/barista-compact/MCF-MAC-B2C2-BLA-M) choose a colour and click **Add to bag** | A **Ship** line |
| On [Alba Mug](https://omni-industry-starter.netlify.app/en-US/p/alba-mug/MCF-POD-ALBA-10) select the **Collect** card and reserve it | A **Collect** line tied to the chosen store |
| On [Espresso Roma](https://omni-industry-starter.netlify.app/en-US/p/espresso-roma/MCF-COF-ROMA-250-WB) choose **Subscribe**, pick an interval and click **Subscribe** | A **Subscribe** line priced 10% below the one-time price |
| Open the [cart](https://omni-industry-starter.netlify.app/en-US/cart) | Three clusters: **Collect**, **Shipping to you** and **Subscriptions**. Every line sits in its cluster with its own chip and line total |
| Look at the **Collect** cluster's shipping | **Free**. Collection is its own shipping method priced at zero |
| *(no click)* | Each line carries a `fulfilment` value — `collect`, `delivery` or `subscribe` — stored as a custom type on the line item. The cart, the order, the account and the collection tracker read the same value |

## D — Two markets

| Click this | What it shows |
|---|---|
| ▶ Open the [Home page](https://omni-industry-starter.netlify.app/en-US) with at least one item in the bag | US market, USD |
| Open **Country and language** and choose **Canada** | The URL becomes `/en-CA`, prices switch to CAD and the bag is rebuilt in CAD, so a cart never holds two currencies |
| Look at the header | The store pill and **Collect** are gone. All six stores are in New York, so Canada is delivery only |
| Look at the top strip | Free shipping above **99 CAD** (US: **75 USD**). Standard delivery is **8.95 CAD** below it (US: **6.95 USD**) |
| *(no click)* | Tax follows the market: pods and coffee 0% in both countries; machines, accessories and gifts 8% in the US (8.875% for New York) and 5% GST in Canada |

## E — Discount codes

| Click this | What it shows |
|---|---|
| ▶ Open the [cart](https://omni-industry-starter.netlify.app/en-US/cart) with the bag from C | Items in all three clusters |
| Apply `WELCOME10` | 10% off the cart, shown as a discount line |
| Apply `FREESHIP` as well | Standard shipping drops to **Free**. The two stack; remove it and shipping returns |
| Apply `COFFEE15` | $15 off (20 CAD in Canada) on a cart over $60 (80 CAD) |
| *(no click)* | Codes are entered in the cart. The hosted Checkout's own discount field is switched off so there is one place to enter them |

## F — Subscriptions

| Click this | What it shows |
|---|---|
| ▶ Sign in as **Liam Carter**, place an order that contains a **Subscribe** line, then open [Subscriptions](https://omni-industry-starter.netlify.app/en-US/account/subscriptions) | The page lists a subscription once an order with a recurring line exists |
| Look at the card | Lines, interval, **Next delivery** date, per-delivery price and status **Active** |
| Click **Change interval** and choose **Every month** | The card updates in place. The intervals are **Every 2 weeks**, **Every month**, **Every 2 months** and **Every 3 months** |
| Click **Skip next** | **Next delivery skipped**. While a skip is pending **Change interval** is disabled, because the platform accepts a schedule change only on a recurring order with no active skip ([reference](https://docs.commercetools.com/api/projects/recurring-orders)) |
| *(no click)* | These are commercetools recurring orders, created by the platform when an order contains recurring lines, one per distinct schedule ([overview](https://docs.commercetools.com/api/projects/recurring-orders-overview)) |

## G — Reviews

| Click this | What it shows |
|---|---|
| ▶ Open [Alba Mug](https://omni-industry-starter.netlify.app/en-US/p/alba-mug/MCF-POD-ALBA-10) | The rating summary with a bar per star level, from the product's `reviewRatingStatistics` ([guide](https://docs.commercetools.com/guides/review-ratings)) |
| Click **Write a review** signed out | A sign-in prompt |
| Sign in and write a review | The review appears at once; there is no moderation step |

## H — Account

| Click this | What it shows |
|---|---|
| ▶ Sign in as **Maya Okonkwo** and open [Account](https://omni-industry-starter.netlify.app/en-US/account) | The account overview |
| Click **Orders** | Newest first, each with a status pill. Collection orders move through **Ordered**, **Preparing**, **Ready for collection** and **Collected** |
| Click **Collection** | Saved store, address, hours and phone. **Change store** updates availability across the site |
| Click **Addresses** and **Saved** | An address book with a default, and saved items |

## What's real

| Feature | What runs, and where it stops |
|---|---|
| Catalog, categories, prices, stock | A live commercetools project with category tree, USD and CAD prices, per-store stock and ratings · the catalog is seeded for this demo, not Malva Coffee's own |
| Cart, discount codes, tax, shipping | Calculated by commercetools · Canadian provincial tax is not modelled |
| Orders and recurring orders | Created in the project |
| Payment | The hosted commercetools Checkout with Stripe in test mode · no money moves; use Stripe test cards |
| Six New York stores | Per-store stock through supply channels · the store addresses are invented and opening hours are seeded, so the picker can read **Closed today** |
| Product pictures | Stock photography that illustrates the layout, not the products |
| Accounts | Created verified · no email is sent and there is no password reset |

**Not built:** French for Canada (`en-CA` is English only); collection in Canada.

## If something looks off

| Symptom | Cause |
|---|---|
| A product link returns 404 | Product URLs end in a SKU, as in `/p/alba-mug/MCF-POD-ALBA-10`. Open the product from a category page |
| **Subscriptions** is empty | The shopper has no subscription order yet. Place one as in C |
| The pay step reports the service unavailable | The hosted Checkout or its Stripe test connection is not reachable |

## How it's built

The build is in the companion *How the Malva Coffee demo works* document.
