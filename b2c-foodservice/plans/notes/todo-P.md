<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Owner items: workstream P (content and error pages)

Draft for the lead to merge into `TODO-MANUAL-TESTING.md`. `SO-01` already exists; `SO-P1` to `SO-P5` and `OA-P1` are placeholders the lead numbers.

| ID | Who | When needed | Steps | Expected result | Status |
| --- | --- | --- | --- | --- | --- |
| SO-01 (extend) | Owner or legal | Before release | 1. Open `storefront/content/policies.ts`. 2. Supply or approve Impressum, privacy, terms of sale, cookie statement and returns text for US, DE and GB. 3. Set `isDraft: false` per policy and the real `effectiveDate`. | Final text; draft banner gone | TODO |
| SO-P1 | Owner | Before release | 1. Open the screenshots in `plans/evidence/P/` (About, Contact, FAQ, a policy, Journal list and article, 404, 500). 2. These pages have no design; approve or list changes. | Approval or change list | TODO |
| SO-P2 | Owner | Before release | 1. Read `storefront/content/about.ts` and `content/faq.ts`. 2. Approve or rewrite every answer; confirm no claim (certification, sourcing, recycling) is untrue. | Approved copy | TODO |
| SO-P3 | Owner | Before release | Supply customer-care email, phone, opening hours and reply time per market (US, DE, GB) for `storefront/content/contact.ts` (values today are placeholders on the `.example` domain). | Real channels in the file | TODO |
| SO-P4 | Owner and legal | Before release | Decide whether a cookie or consent banner is needed (no analytics or third-party scripts today; session and market cookies are essential). Write the decision under Q-P-6. | Decision recorded | TODO |
| SO-P5 | Owner | Before release | Replace the three drafted journal articles in `storefront/content/journal/` with real ones (or remove them) and supply images. | Real articles | TODO |
| OA-P1 | Owner | Before the contact form works outside tests | 1. Choose where enquiries go (helpdesk, Slack or Teams incoming webhook, form service). 2. Put its URL in `storefront/.env.local` and in the host settings as `CONTACT_WEBHOOK_URL`; token (if any) as `CONTACT_WEBHOOK_TOKEN`. 3. Optionally `FEEDBACK_WEBHOOK_URL` for FAQ votes. 4. Tell the team it is set; never paste the value in chat. | A real submit shows a confirmation and the message arrives at the receiver | TODO |
| M-P-01 | Owner | After OA-P1 | Send a real enquiry from the deployed site on a phone; read it at the receiver. | The reference on screen equals the reference at the receiver | TODO |
| M-P-02 | Owner or accessibility reviewer | After P-15 | Read Contact, FAQ and a policy with VoiceOver (macOS) or TalkBack. | Headings, form errors, details toggles and the fallback notice are announced sensibly | TODO |
| M-P-03 | German-speaking reviewer | Before release | Read the German strings, German policy texts and the imprint. | Natural wording; imprint complete | TODO |
