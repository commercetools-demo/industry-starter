# Broadband Facts label

Source: `source/BroadbandLabel.dc.html`. Props: `label` object. Preview 420×900.

**Deliberately outside the brand system**: literal black on white, 2px black border, Roboto, no radius, no tokens (the FCC consumer label format). Do not recolor with brand tokens; do not apply the DS lint rule for raw hex to this component.

Structure (top→bottom; rule weight signals hierarchy — 8px thick rules between major blocks, 4px between sections, 1px between rows):
1. Title "Broadband Facts" (Roboto 900 34, −.5px tracking)
2. 8px rule · Provider "Malva Telecom" (700 17), plan name, service kind, "Fixed & mobile broadband consumer disclosure"
3. 4px · **Monthly Price** + price (900 20/24); price note; "Provider Monthly Fees" rows
4. 4px · **One-time Fees at the Time of Purchase** rows; **Other Fees**: Early termination fee, Government taxes ("Varies by location")
5. 4px · **Discounts & Bundles** text
6. 8px · **Speeds Provided with Plan**: typical download / upload / latency rows
7. 4px · **Data Included with Monthly Price**: Monthly data; "Charges for additional data usage: none"
8. 4px · **Network Management & Privacy** (policy URL)
9. 4px · **Customer Support** (phone, URL)
10. 2px · footnote "Learn more about the terms used on this label at fcc.gov/consumer. Unique plan ID: {id}"

Data contract `label`: `id` (e.g. `MLV-CA-101`), `planName`, `kind`, `price`, `priceNote`, `monthlyFees[{k,v}]`, `oneTime[{k,v}]`, `etf`, `discounts`, `speeds[{k,v}]`, `data`. Prototype placeholders to replace: `malva.example` URLs, `1-800-MALVA-00`. Plan IDs, fees and speeds must come from commercetools product/variant attributes (see `openspec/specs/broadband-facts-label`).
