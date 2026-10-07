// Only a tie-break for categories without an order hint (or with equal hints). Design order: Phone plans, Wireless internet,
// Cable internet, Add-ons, then the devices root added by G.
export const NAV_TIE_BREAK_ORDER: readonly string[] = [
  'malva-cat-phone-plans',
  'malva-cat-home-wireless',
  'malva-cat-cable-internet',
  'malva-cat-add-ons',
  'malva-cat-devices',
];
