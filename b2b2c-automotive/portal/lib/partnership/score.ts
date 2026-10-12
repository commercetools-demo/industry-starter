// Compliance score of the Brand partnership page (D9). Pure.
// `checked` = local products that claim fitment, `flags` = those whose claim is still pending Malva review.
// score = round(100 * (1 - flags / checked)); nothing checked shows "—" (null), never 100.
export function complianceScore(checked: number, flags: number): number | null {
  if (checked <= 0) return null;
  return Math.round(100 * (1 - Math.min(flags, checked) / checked));
}
