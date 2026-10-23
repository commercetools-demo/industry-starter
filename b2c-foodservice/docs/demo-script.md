---
title: "Malva Coffee demo script"
---

# Malva Coffee demo script

Malva Coffee is a B2C online coffee retailer — capsules, beans, machines, accessories and gifts — selling in the US (USD) and Canada (CAD) on commercetools. Each beat below is a table: the left column is what you click, the right column is what that click shows. Rows marked *(no click)* are pure explanation and are usually the important ones. The companion document, *How the Malva Coffee demo works*, covers the build.

## The site and the gate password

| What | Value |
|---|---|
| Storefront | <https://omni-industry-starter.netlify.app/en-US> |
| Gate password | `malva-coffee-994` — the gate also asks for your work email, which is only used to record who visited |
| Shopper accounts | None to type. The sign-in page has a **demo sign-in** list below the sign-in box; pick a name and you are signed in |

The gate is the first thing a new visitor sees. Enter the email, enter the password once, and it remembers you.

## If you read one beat, read C

**Beat C — one bag, three ways to receive it.** A single bag holds a machine that ships, capsules collected from a New York store, and a coffee subscription. Every line sits in its own cluster (**Collect**, **Shipping to you**, **Subscriptions**) with its own promise and price. Most storefronts make the shopper pick one fulfilment method per order; this one keeps the choice per line, and the order that comes out the other side records which method each line used.

## Beat map

| Beat | What it shows |
|---|---|
| A — Browse | Category tree, facets with live counts, ratings, per-capsule unit price |
| B — Product page | One page, three ways to buy: **Collect**, **Ship**, **Subscribe** |
| C — The mixed bag | Collect, ship and subscribe lines in one cart, each in its cluster |
| D — Two markets | US and Canada: currency, tax, shipping thresholds and collection switch together |
| E — Discount codes | Three stackable codes and what each does to the cart |
| F — Subscriptions | Recurring orders the shopper manages: skip, pause, change interval |
| G — Reviews | Ratings written by shoppers and counted at once |
| H — Account | Orders, collection tracker, addresses, saved items |

## Signing in

| Click this | What it shows |
|---|---|
| ▶ **Start here:** [Sign in](https://omni-industry-starter.netlify.app/en-US/account/sign-in) · gate password `malva-coffee-994` | Signed out. The **demo sign-in** list sits below the sign-in box |
| Pick **Maya Okonkwo** | US shopper. Signed in through the same server-side login the form uses; the password never reaches the browser |
| *(no click)* | The six demo shoppers: **Maya Okonkwo**, **Liam Carter**, **Noah Patel** (US) and **Priya Nair**, **Lucas Tremblay**, **Ava MacKenzie** (Canada). Each has a default shipping and billing address in their market |

## Every screen this uses

| Screen | State it should be in | Beat |
|---|---|---|
| [Home](https://omni-industry-starter.netlify.app/en-US) | Signed out, US market | A, D |
| [Pods](https://omni-industry-starter.netlify.app/en-US/category/pods) | Any | A |
| [Machines](https://omni-industry-starter.netlify.app/en-US/category/machines) | Any | A |
| [Alba Mug pods](https://omni-industry-starter.netlify.app/en-US/p/alba-mug/MCF-POD-ALBA-10) | A US store chosen | B, C |
| [Espresso Roma](https://omni-industry-starter.netlify.app/en-US/p/espresso-roma/MCF-COF-ROMA-250-WB) | Signed in | F |
| [Barista Compact](https://omni-industry-starter.netlify.app/en-US/p/barista-compact/MCF-MAC-B2C2-BLA-M) | Any | C |
| [Cart](https://omni-industry-starter.netlify.app/en-US/cart) | Bag from beat C | C, E |
| [Subscriptions](https://omni-industry-starter.netlify.app/en-US/account/subscriptions) | Signed in as a shopper with a subscription | F |
| [Canada home](https://omni-industry-starter.netlify.app/en-CA) | Any | D |

Optional, for whoever is about to give the demo and has the repo: open the tabs above in order with a short pause between each — `open` returns before the tab exists, so firing them at once scrambles the order. An outside reader does not need this; the table is enough.

## ⚠️ Traps

- **Do not place a real-looking order unprepared.** Payment runs through the hosted commercetools Checkout connected to Stripe in test mode. Use a Stripe test card, never a real one, and place a test order before presenting so you know the pay step works that day.
- **Store opening hours.** The store picker lists six New York stores and today reads **Closed today** on each. If you collect-demo on a day the picker says closed, say that hours are seeded data and move on rather than debating it.
- **Collection is a US feature.** Canada has no store picker and no **Collect** option; that is the design (beat D), not a bug.
- **Images are stock photography.** Product pictures come from Pexels; they illustrate the layout, not the products.

## A — Browse

| Click this | What it shows |
|---|---|
| ▶ **Start here:** [Home](https://omni-industry-starter.netlify.app/en-US) · gate password `malva-coffee-994` | Signed out, US market, USD |
| Read the top strip | **Free shipping over $75.00 · Free café collection, ready in 30 min · 30-day returns.** The $75 comes from the shipping rate itself, not from text in the page |
| Hover **Coffee Beans** in the header | A mega menu built from the commercetools category tree — **Ground**, **Single origin**, **Blends**, **Subscriptions** — which a merchandiser edits, not a list in the code |
| Open [Pods](https://omni-industry-starter.netlify.app/en-US/category/pods) and apply **Intensity** then **Roast** filters | Facet counts update against the other active filters; the URL carries the filters so a copied link reproduces the view |
| Look at a pod card | **Alba Mug $7.90** with **$0.79 per capsule** — the unit price is computed, so a 10-pack and a 100-box compare fairly |
| Open [search](https://omni-industry-starter.netlify.app/en-US/search?q=espresso) | Results and facets from the commercetools Product Search, not from a local index. The catalog is 41 products |

## B — Product page

| Click this | What it shows |
|---|---|
| ▶ **Start here:** [Alba Mug](https://omni-industry-starter.netlify.app/en-US/p/alba-mug/MCF-POD-ALBA-10) · gate password `malva-coffee-994` | A pod product, US market, store not yet chosen |
| Click **10 sleeve / 50 box / 100 box** | Variants of one product with their own price and per-capsule price |
| Click the store pill, choose **Malva Coffee SoHo** | The picker lists six New York stores. The pill now reads **Collect at …** and stays chosen across pages |
| Look at the **Collect** card | **In stock at** the store, with the readiness time — stock is read per store, not for the whole business |
| Open a machine page such as [Barista Compact](https://omni-industry-starter.netlify.app/en-US/p/barista-compact/MCF-MAC-B2C2-BLA-M) | Machines offer **Ship** only: no **Subscribe** card, because a machine is not a recurring item |
| *(no click)* | The subscribe option appears only on products flagged subscribable (pods and coffee) — see the **Subscribe & save** badge on the card |

## C — The mixed bag

> **This beat is the whole argument.** One bag, three fulfilment methods, one checkout.

| Click this | What it shows |
|---|---|
| ▶ **Start here:** [Sign in](https://omni-industry-starter.netlify.app/en-US/account/sign-in) as **Maya Okonkwo** · gate password `malva-coffee-994` | Signed in, empty bag, store **Malva Coffee SoHo** chosen |
| On [Barista Compact](https://omni-industry-starter.netlify.app/en-US/p/barista-compact/MCF-MAC-B2C2-BLA-M) choose a colour, **Add to bag** | A **Ship** line. $399.00 |
| On [Alba Mug](https://omni-industry-starter.netlify.app/en-US/p/alba-mug/MCF-POD-ALBA-10) with the **Collect** card selected, press the reserve button | A **Collect** line tied to the SoHo store |
| On [Espresso Roma](https://omni-industry-starter.netlify.app/en-US/p/espresso-roma/MCF-COF-ROMA-250-WB) choose **Subscribe**, an interval, **Subscribe** | A **Subscribe** line with a price locked at 10% below the one-time price |
| Open the [cart](https://omni-industry-starter.netlify.app/en-US/cart) | Three clusters: **Collect · Malva Coffee SoHo**, **Shipping to you**, **Subscriptions**. Every line sits inside its cluster with its own chip and line total; none float outside |
| Read the **Collect** cluster's shipping | **Free** — collection has its own shipping method priced at zero, so the saving is real data, not a label |
| *(no click)* | Each line carries a `fulfilment` field (`collect`, `delivery` or `subscribe`) as a custom type on the line item. That field is how the order, the account and the collection tracker know what to do with each line later |

## D — Two markets

| Click this | What it shows |
|---|---|
| ▶ **Start here:** [Home](https://omni-industry-starter.netlify.app/en-US) · gate password `malva-coffee-994` | US market, USD, a bag with at least one line |
| Open **Country and language**, choose **Canada** | URL becomes `/en-CA`, prices in CAD, and the bag is rebuilt in CAD — a cart never holds two currencies |
| Look at the header | The store pill and **Collect** are gone: all six stores are in New York, so Canada is delivery only |
| Look at the top strip | Free shipping above **99 CAD** (US: **75 USD**). Standard delivery is **8.95 CAD** below it (US: **6.95 USD**) |
| *(no click)* | Tax follows the market: pods and coffee 0% in both countries; machines, accessories and gifts 8% US (8.875% for New York) and 5% GST in Canada. Canadian provincial tax is not modelled |

## E — Discount codes

| Click this | What it shows |
|---|---|
| ▶ **Start here:** [Cart](https://omni-industry-starter.netlify.app/en-US/cart) · gate password `malva-coffee-994` | The mixed bag from beat C |
| Apply `WELCOME10` | 10% off the cart as a discount line |
| Apply `FREESHIP` as well | Standard shipping drops to **Free**; the two stack. Remove it to see shipping return |
| Apply `COFFEE15` | $15 off (20 CAD in Canada) on a cart over $60 (80 CAD) |
| *(no click)* | Codes live in the cart, not in checkout: the hosted Checkout's own discount field is switched off so there is one place to enter them |

## F — Subscriptions

| Click this | What it shows |
|---|---|
| ▶ **Start here:** [Subscriptions](https://omni-industry-starter.netlify.app/en-US/account/subscriptions) · gate password `malva-coffee-994` | Signed in as **Liam Carter**, after a subscription order has been placed (the page is empty until then) |
| Read the card | Lines, interval, **Next delivery** date, per-delivery price, status **Active** |
| **Change interval** to **Every month** | The same card updates in place. Four intervals exist: **Every 2 weeks**, **Every month**, **Every 2 months**, **Every 3 months** |
| **Skip next** | **Next delivery skipped**. While a skip is pending **Change interval** is disabled — the platform only accepts a schedule change on a recurring order with no active skip ([API reference](https://docs.commercetools.com/api/projects/recurring-orders)), so the screen does not offer it |
| *(no click)* | These are commercetools recurring orders, created by the platform when an order contains recurring lines — one per distinct interval ([overview](https://docs.commercetools.com/api/projects/recurring-orders-overview)) |

## G — Reviews

| Click this | What it shows |
|---|---|
| ▶ **Start here:** [Alba Mug](https://omni-industry-starter.netlify.app/en-US/p/alba-mug/MCF-POD-ALBA-10) · gate password `malva-coffee-994` | Signed in as any demo shopper |
| Read the summary | **3.9** from **7** reviews, with a distribution bar per star level — the platform's own rating statistics |
| **Write a review** | Signed-out visitors get a sign-in prompt. Signed in, the review appears at once: there is no moderation step |

## H — Account

| Click this | What it shows |
|---|---|
| ▶ **Start here:** [Account](https://omni-industry-starter.netlify.app/en-US/account) · gate password `malva-coffee-994` | Signed in as **Maya Okonkwo** |
| **Orders** | Newest first with a status pill. Collection orders move through **Ordered**, **Preparing**, **Ready for collection**, **Collected** |
| **Collection** | Saved store, address, hours and phone. **Change store** updates availability across the whole site |
| **Addresses**, **Saved** | Address book with a default; saved items |

## Q&A → where each answer lives

| Question | Where |
|---|---|
| Can one order mix pickup and delivery? | Beat C |
| How do two countries run on one project? | Beat D |
| Is stock per store? | Beat B, the **Collect** card |
| How are subscriptions modelled? | Beat F; *How it works*, subscriptions section |
| Where does payment happen? | The hosted Checkout, after the cart. *How it works*, checkout section |
| Can we add French for Canada? | Not built; `en-CA` is English only |

## If something looks wrong

| Symptom | Cause · fix |
|---|---|
| Redirected to a gate page | Expected for a first visit. Enter your work email and `malva-coffee-994` |
| A product link answers 404 | Product URLs end in a SKU, for example `/p/alba-mug/MCF-POD-ALBA-10`. Open it from a category page |
| Subscriptions page is empty | Nothing has been subscribed yet for that shopper. Place a subscription order first (beat C) |
| Every store says **Closed today** | Store hours are seeded data and currently read empty. Not a live opening-hours feed |
| Pay step reports the service unavailable | The Checkout application or its Stripe test connection is not reachable; test an order before presenting |

## What's real and what's stubbed

| Real | Stubbed or limited |
|---|---|
| 41 products in a live commercetools project, with category tree, prices in USD and CAD, per-store stock and ratings — a seeded catalog, not a customer's | Product pictures are stock photos from Pexels |
| Cart, discount codes (`WELCOME10`, `FREESHIP`, `COFFEE15`), tax and shipping computed by commercetools | Canadian provincial tax is not modelled |
| Orders and recurring orders created in the project | No email is sent anywhere; no password reset; accounts are verified on creation |
| Payment through the hosted commercetools Checkout with Stripe in test mode | No real money moves; test cards only |
| Six New York stores with stock per store | The stores are invented addresses, and opening hours are empty |
