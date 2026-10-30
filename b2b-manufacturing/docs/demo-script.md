# Malva Plumbing & Waste — Demo Guide

A commercetools storefront for Malva, a B2B plumbing and waste-management services company. Companies browse services, collect them in a quote list, request a quote, and follow quotes, sites, service visits, waste documents and invoices in a client portal. The site runs in English (USD) and German (EUR).

| | |
|---|---|
| **Open** | [Malva site](https://service-b2b-industry-starter.netlify.app/en-US) |
| **Sign in** | The sign-in page has **Sign in as sample customer**, where enabled. Sample customers: **Dana Admin** (Administrator) and **Sam Site** (Site contact) and **Fran Finance** (Finance) at Northfield Foods (demo); **Olu Other** (Administrator) at Riverside Care Group (demo) |
| **Or register** | **Register your company** creates a customer, a company and its administrator, and signs you in |

**Short on time? Go to E** — a quote moves from request to staged quote to the client's accept, decline or renegotiate decision.

## A — Services are products

| Click this | What it shows |
|---|---|
| ▶ Open the [homepage](https://service-b2b-industry-starter.netlify.app/en-US) | Two service lines, **Plumbing** and **Waste management**, with sector entry points and proof panels |
| Click **Plumbing** in the top navigation | The listing of plumbing services. Each service is a commercetools Product; the listing is read through Product Search, scoped to the Malva store |
| Use the sector links (**Facilities management**, **Manufacturing**, **Property / real estate**, **Healthcare**) | The listing narrows to the services for that sector. **Clear filter** returns to the full list |
| Click **Waste management** | The same listing layout over the waste services |

> Services carry no price. They are Products so they can be added to a cart; the site asks for a quote rather than a payment.

## B — A service page and the quote list

| Click this | What it shows |
|---|---|
| ▶ Open any service from [Plumbing](https://service-b2b-industry-starter.netlify.app/en-US/plumbing) | The service page: what is included, who it is for, how it works, records produced, FAQ and related services |
| Choose a frequency (**One-off**, **Weekly**, **Every two weeks**, **Monthly**, **Quarterly**, **Annual**) and click **Add to list** | The service joins the quote list in the header counter |
| Add a second service, then open **Quote list** | One row per service with its category, a frequency selector and a notes field. **Remove** drops a row |
| *(no click)* | The list is a commercetools cart. It works without signing in; no payment is taken |

## C — Request a quote

| Click this | What it shows |
|---|---|
| ▶ With at least one service in the quote list, click **Request a quote** | A three-step form: **Service**, **Site**, **Contact** |
| Complete the steps while signed out | Registration comes first: a Quote Request needs a customer and a company, so the form creates them before it submits |
| Submit | The request appears under **Quotes and requests** in the portal |

## D — The client portal

| Click this | What it shows |
|---|---|
| ▶ Open [Sign in](https://service-b2b-industry-starter.netlify.app/en-US/account/sign-in) and click **Sign in as sample customer**, or click **Client portal** in the top bar | The portal **Overview**: next scheduled visits, open quote requests, latest invoice and compliance alerts |
| Use the portal navigation: **Service visits**, **Waste documents**, **Invoices**, **Quotes and requests**, **Sites**, **Team**, **Settings** | Each page lists records for the signed-in user's company only. Portal pages require a session |
| Sign out, then open a portal URL | You are sent to sign in; no portal data is returned |

> The portal's visits, waste documents and invoices are sample data, marked **Demo data** on each list.

## E — Quotes and requests

| Click this | What it shows |
|---|---|
| ▶ Sign in as **Dana Admin**, open **Quotes and requests** | The company's quote requests and quotes with their status |
| Open a quote that is waiting for a decision | The quote detail with accept, decline and renegotiate actions |
| Accept, decline or renegotiate | The decision is written back to the commercetools Quote. Quote Requests belong to a company, which is why registration comes first |

## F — Sites and team

| Click this | What it shows |
|---|---|
| ▶ Sign in as **Dana Admin**, open **Sites** | The company's sites. Add a site; it appears in the request form's **Site** step |
| Open **Team** | Colleagues in the company with their roles. Invite a colleague |
| Sign in as **Sam Site** or **Fran Finance** | The same company, seen through a different role |

## G — Two companies, two languages

| Click this | What it shows |
|---|---|
| ▶ Sign in as **Olu Other** | **Riverside Care Group (demo)** data only; nothing from Northfield Foods |
| Use the language and region control in the top bar to switch to German | The page stays where it is. A quote list in progress is re-created in EUR, with a notice |

## What's real

| Feature | What runs for real, and where it stops |
|---|---|
| Services, categories, listings, Product Search | Products and categories in a commercetools project; the German copy is an unverified translation |
| Quote list | A commercetools cart, USD or EUR by locale |
| Registration | Creates a customer, a Business Unit and an administrator association. No email is sent; accounts are marked verified on creation |
| Quote requests and quotes | Created and decided through commercetools. Staging a quote is done by the seller side, outside this site |
| Sites and team | Stored as Business Units and associates |
| Service visits, waste documents, invoices | Sample records, not a live back-office feed |
| Stats, accreditations, testimonials, phone and email | Placeholder content, each marked **Sample content** |
| Sign in as sample customer | Available only where the deployment sets it up |

**Not built:** email notifications, online payment.

## If something looks off

| What you see | Why |
|---|---|
| No **Sign in as sample customer** box | The sample sign-in is switched off in that deployment. Register a company instead |
| Records differ from this guide | Other visitors share the sample companies |

## How it's built

How it works: *link to the Doc once published.*
