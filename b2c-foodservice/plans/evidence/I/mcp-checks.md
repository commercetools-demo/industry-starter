# I-00 live platform checks

Not run: they need the live API client (OA-01). Row OA-I-a lists the seven checks. The code is written to the documented behaviour: `setLineItemSupplyChannel` without `supplyChannel` removes it, `DiscountCodeNonApplicable.reason` is read from the error body, `discountCodes[].state` comes from the expanded cart, `taxedPrice` absent shows "Calculated at checkout".
