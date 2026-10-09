# Account area (client portal) — design spec

Source: `Malva.html` — only the **sign-in modal** and its triggers are designed (top bar link, nav outline button, footer link). The authenticated area is **proposed**, assembled from the modal copy ("View service visits, waste transfer notes and invoices.") and the account-area pattern of the Store Launchpad system (260px left sidebar, tables, status badges).
Behaviour: `openspec/changes/malva-website/specs/malva-client-portal/spec.md`.

## Sign-in (designed)

Modal 420px: H3 "Client portal", muted copy, Email, Password, **Sign in**. Backdrop click closes. Prototype just shows "Signed in — Sample only".

Proposed: dedicated `/account/sign-in` page for deep links plus the modal for quick access; no "Forgot password" link (owner decision Q-023: no password reset); error "Email or password is incorrect."; **open registration** (decision D4, owner-confirmed): link "No account yet? Register" to a registration page (company name, sector, name, work email, password; same input styles, 2-column grid) followed by a "Check your email" confirmation and an unverified-state screen with a resend action; secondary link "Just need a quote? Request a quote."

## Authenticated area (proposed)

Shell: topbar + nav as the site, left sidebar 260px with meta label "HELLO, {FIRST NAME}" and items:

| Item | Content |
| --- | --- |
| Overview | Next visits, open requests, latest invoice, compliance alerts (expiring certificates, missed collections) |
| Service visits | Table: date (DD/MM/YYYY) · site · service · status badge (Scheduled / In progress / Completed / Missed) · report (PDF) |
| Waste documents | Waste transfer / consignment notes, filter by site, waste type, date; download; annual report |
| Invoices | Number · date · site · amount · status (Paid / Due / Overdue) · PDF |
| Quotes and requests | Submitted quote requests, issued quotes (Accept / Decline / Ask a question), status |
| Sites | Addresses and site contacts for the company (business unit) |
| Team | Users and roles (Admin, Site contact, Finance — read only) |
| Settings | Profile, password, notification preferences |

Status badges use the system's tag/badge styles (info, success, warn, danger).

## States

Empty tables: "No service visits yet." Loading: skeleton rows. Session expiry: redirect to sign-in with return path. Multi-company users: company switcher in the sidebar header.

## Gaps vs. design

All authenticated screens. Source of visit, waste-note and invoice data is an open integration decision (D5 in `PLAN.md`).

## Acceptance

1. No authenticated page is reachable or cacheable without a session; documents are only downloadable by users of the owning company.
2. Tables are real `<table>`s with captions and sortable headers.
3. Every portal list can be filtered by site; the selected filter is in the URL.
4. Sign-out clears the session and any cached portal data.
