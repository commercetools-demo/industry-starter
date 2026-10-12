// The audiences a buyer can be priced as: the groups the catalog read selects for, and the one group an anonymous cart carries.
export interface AudienceCase {
  name: string;
  groupKeys: string[];
  /** The customer group of the cart (a cart carries one; a signed-in customer's own groups apply instead, modelled as the first). */
  cartGroup: string | null;
  allGroups: string[];
}

const ALL = ['consumer', 'small-business', 'employee', 'existing-customer', 'call-center'];

export const audienceCases: AudienceCase[] = [
  { name: 'anonymous consumer', groupKeys: [], cartGroup: null, allGroups: ALL },
  { name: 'declared small business', groupKeys: ['small-business'], cartGroup: 'small-business', allGroups: ALL },
  { name: 'declared employee', groupKeys: ['employee'], cartGroup: 'employee', allGroups: ALL },
  { name: 'existing customer', groupKeys: ['existing-customer'], cartGroup: 'existing-customer', allGroups: ALL },
];
