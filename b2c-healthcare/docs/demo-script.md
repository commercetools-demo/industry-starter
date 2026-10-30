# Malva Healthcare — Demo Guide

A commercetools storefront for a US health retailer, Malva Healthcare: patients book doctors by video or in the office, and order prescription and over-the-counter medicines against a prescription number, with insurer and benefit funding, auto-refill and a private account area.

| | |
|---|---|
| **Open** | [healthcare-b2c-industry-starter.netlify.app](https://healthcare-b2c-industry-starter.netlify.app/en-US) |
| **Sign in** | Three demo patients: `sam.rivera@example.com` (funded by a health plan, has prescriptions, labs and appointments), `alex.chen@example.com` (no funding, no credentials), `jordan.lee@example.com` (no funding, credential awaiting verification). Password: TODO (set at seed time, not stored in the repo) |

**Short on time? Go to C** — a prescription number becomes a cart line, and the dispensing rules decide what can be added.

## A — Find and book a doctor

| Click this | What it shows |
|---|---|
| ▶ Open [Doctors — Remote](/en-US/doctors/remote) | The doctor list for video visits. No sign-in needed |
| Switch to the office list at [/en-US/doctors/office](/en-US/doctors/office) | Each doctor offers remote, office or both. Doctors are products; the fee for each mode is a price on a price channel, and the filter runs on a product attribute through Product Search |
| Use the filters and search box | Filters live in the URL, and availability badges come from the doctor's schedule |
| Open any doctor and click a time slot | The booking panel opens as a dialog. Signed out, it reads **Booking as a guest** |
| Fill **Full name**, **Email**, **Phone**, **Reason for visit** and click **Confirm booking** | The confirmation page has a `BK-` reference. The URL carries no name, email or reason — health detail never goes in a URL |

## B — Sign in and the account area

| Click this | What it shows |
|---|---|
| ▶ Open [Sign in](/en-US/login) and sign in as Sam Rivera | The account overview greets Sam by name |
| Open **Labs**, then a lab result | Result values, with a PDF download. Another patient's lab id returns not-found |
| Open **Appointments** | Bookings made while signed in or as a guest with the same email |
| Open **Addresses**, **Add address** | Saved addresses are reused at checkout |

> Prescriptions and lab results are a stand-in held in commercetools Custom Objects, standing in for an EHR. They are not a real clinical system.

## C — Order from a prescription

| Click this | What it shows |
|---|---|
| ▶ Open [Prescriptions](/en-US/prescriptions) signed in as Sam | A lookup by prescription number |
| Look up `RX-77102` | The prescribed medicine with quantity, refills remaining and the dispensing limit |
| Click **Add to cart** and open the [cart](/en-US/cart) | The prescription line replaces rather than duplicates; totals are calculated by commercetools. Sam's cart shows an **Allowance balance** |
| Click **Checkout**, choose a saved address | Delivery options include same-day with a cut-off time |
| Look at the payment area | **No card payment is needed** when the benefit allowance covers the order |
| Click **Place order** | The order page shows **Order placed** with a timeline; the URL carries no medicine name or prescription number |
| Open **Orders**, then an order, then **Cancel order** | **Order cancelled**; the allowance is released |

> Cost-share, allowance and credential checks run against mock resolvers, not a real insurer.

## D — Dispensing rules

| Click this | What it shows |
|---|---|
| ▶ Sign in as Alex Chen, open [Prescriptions](/en-US/prescriptions), look up `RX-42017` | **Requires a valid Schedule IV credential. You have none on file.** **Add to cart** is disabled |
| Sign in as Jordan Lee, look up `RX-58833` | The credential is **awaiting verification**; **Add to cart** is disabled |
| Sign in as Sam Rivera, look up `RX-61044` | Sam holds a verified credential, so the line can be added |
| *(no click)* | Other rules apply the same way: a per-order quantity limit, a monthly ceiling, a refill ledger and a remaining-shelf-life promise on expiry-dated supply. The BFF enforces them |

## E — Payment without funding

| Click this | What it shows |
|---|---|
| ▶ Sign in as Jordan Lee, look up `RX-55120`, add it to the cart and open **Checkout** | A patient with no funding pays by card. The payment area reads **DEMO payment** |
| Tick **Simulate a declined payment** and click **Place order** | An alert shows and the cart stays at checkout |
| Untick it and click **Place order** again | The order is placed |

> The card step is a demo payment provider, not a live PSP.

## F — Auto-refill and saved items

| Click this | What it shows |
|---|---|
| ▶ Sign in as Sam Rivera and open **Auto-refill** (`/en-US/account/auto-refill`) | Needs a saved payment method; add one under **Payment methods** first |
| Tick a medicine and click **Set up auto-refill** | It appears as **Active**. Auto-refill is a commercetools recurring order |
| Click **Pause**, then **Resume** | Status moves between **Paused** and **Active** |
| Open **My medicines** (`/en-US/account/lists`) | Saved lists of medicines |

## What's real

| Feature | Real, and where it stops |
|---|---|
| Doctors, medicines, prices, inventory, cart totals, orders, recurring orders | Run in commercetools · the catalogue is synthetic and the seed uses US dollars and a single region (`en-US`) |
| Patients | Synthetic customers on `example.com` · no real people |
| Prescriptions and labs | Custom Objects as an EHR stand-in |
| Cost-share, allowance, restricted tender, credentials | Mock resolvers |
| Payment | DEMO provider; the Checkout adapter is in the code and has not been run live |
| Dispensing limits | Enforced in the storefront's server layer, so they can be bypassed by calling the commercetools API directly; auto-refill runs are gated ahead of time, not intercepted |
| Email | None is sent; accounts are auto-verified and there is no password reset |

**Not built:** password reset, region switcher (hidden while there is one region), profile editing beyond name and password.

## If something looks off

| Symptom | Cause |
|---|---|
| Time slots differ from day to day | Slots come from schedules and are claimed once booked |

## How it's built

TODO: link the published how-it-works Doc (not yet created).
