/** Up to two capital letters from a first and last name: "Sam Rivera" gives "SR". Empty when there is no name. */
export function initialsOf(firstName?: string | null, lastName?: string | null): string {
  const letters = [firstName, lastName]
    .map((part) => Array.from((part ?? '').trim())[0] ?? '')
    .filter(Boolean)
    .join('');
  return letters.toLocaleUpperCase('en-US');
}
