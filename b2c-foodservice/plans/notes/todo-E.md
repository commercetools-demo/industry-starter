<!-- SPDX-License-Identifier: MIT -->
<!-- Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED. -->

# Manual testing and owner items: workstream E (draft)

Existing SO-03 (German review) is referenced, not redefined.

| ID | Who | When needed | Steps | Expected result | Status |
| --- | --- | --- | --- | --- | --- |
| SO-x (E1) | Owner or designer | Before release (does not block building) | 1. Run `cd storefront && npm run dev`. 2. Open `http://localhost:3000/en-US/dev/design` and scroll to Icons. 3. Judge the four coffee glyphs `cup`, `bean`, `capsule`, `machine` at 24 px and 96 px. 4. Approve, or send replacement path data (24px viewBox, 1.75 stroke, round caps). | Written approval or replacement paths | TODO |
| M-E-01 | Owner | Optional, after E is Ready for review | 1. Open `/en-US/dev/design` on a real phone and on a desktop browser. 2. Compare buttons, chips, fields, stepper, steps, drawer and modal with the VELA screenshots in `design/export/b2b2c-retailer-design/project/screenshots/`. | "Looks like the design" or a list of differences | TODO |
| M-E-02 | Owner | Before release | 1. Read plan note Q-E-1. 2. Confirm: `--ink-3` value `#7C7975` becomes `#6E6B67`; new tokens `--teal-text` and `--danger-text` exist for AA contrast. | Approval, or "keep VELA value" (the accessibility check then fails and is waived in writing) | TODO |
