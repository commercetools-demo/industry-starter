import type { AssociateRoleDraft } from '@commercetools/platform-sdk';

/**
 * Every grantable permission, copied from the `Permission` enum of the commercetools OpenAPI schema
 * (resource `api-AssociateRole`, read 2026-10-08). Roles may only use names from this list (tested), so a typo
 * fails offline instead of at the API.
 */
export const PERMISSIONS = [
  'AddChildUnits', 'UpdateAssociates', 'UpdateBusinessUnitDetails', 'UpdateParentUnit',
  'ViewMyCarts', 'ViewOthersCarts', 'UpdateMyCarts', 'UpdateOthersCarts', 'CreateMyCarts', 'CreateOthersCarts', 'DeleteMyCarts', 'DeleteOthersCarts',
  'ViewMyOrders', 'ViewOthersOrders', 'UpdateMyOrders', 'UpdateOthersOrders', 'CreateMyOrdersFromMyCarts', 'CreateMyOrdersFromMyQuotes', 'CreateOrdersFromOthersCarts', 'CreateOrdersFromOthersQuotes',
  'ViewMyQuotes', 'ViewOthersQuotes', 'AcceptMyQuotes', 'AcceptOthersQuotes', 'DeclineMyQuotes', 'DeclineOthersQuotes', 'RenegotiateMyQuotes', 'RenegotiateOthersQuotes', 'ReassignMyQuotes', 'ReassignOthersQuotes',
  'ViewMyQuoteRequests', 'ViewOthersQuoteRequests', 'UpdateMyQuoteRequests', 'UpdateOthersQuoteRequests', 'CreateMyQuoteRequestsFromMyCarts', 'CreateQuoteRequestsFromOthersCarts',
  'CreateApprovalRules', 'UpdateApprovalRules', 'UpdateApprovalFlows',
  'ViewMyShoppingLists', 'ViewOthersShoppingLists', 'UpdateMyShoppingLists', 'UpdateOthersShoppingLists', 'CreateMyShoppingLists', 'CreateOthersShoppingLists', 'DeleteMyShoppingLists', 'DeleteOthersShoppingLists',
] as const;

export type PermissionName = (typeof PERMISSIONS)[number];

export const ROLE_KEYS = { admin: 'mpw-admin', siteContact: 'mpw-site-contact', finance: 'mpw-finance' } as const;

type RoleDef = Omit<AssociateRoleDraft, 'permissions'> & { permissions: PermissionName[] };

export const roleDrafts: RoleDef[] = [
  {
    key: ROLE_KEYS.admin,
    name: 'Malva company administrator',
    buyerAssignable: true,
    permissions: [
      'CreateMyCarts', 'UpdateMyCarts', 'DeleteMyCarts', 'ViewMyCarts', 'ViewOthersCarts',
      'CreateMyQuoteRequestsFromMyCarts', 'UpdateMyQuoteRequests', 'ViewMyQuoteRequests', 'ViewOthersQuoteRequests',
      'ViewMyQuotes', 'ViewOthersQuotes', 'AcceptMyQuotes', 'AcceptOthersQuotes', 'DeclineMyQuotes', 'DeclineOthersQuotes',
      'RenegotiateMyQuotes', 'RenegotiateOthersQuotes', 'CreateMyOrdersFromMyQuotes', 'ViewMyOrders', 'ViewOthersOrders',
      'UpdateAssociates', 'UpdateBusinessUnitDetails', 'AddChildUnits',
    ],
  },
  {
    key: ROLE_KEYS.siteContact,
    name: 'Malva site contact',
    buyerAssignable: true,
    permissions: [
      'CreateMyCarts', 'UpdateMyCarts', 'DeleteMyCarts', 'ViewMyCarts',
      'CreateMyQuoteRequestsFromMyCarts', 'UpdateMyQuoteRequests', 'ViewMyQuoteRequests',
      'ViewMyQuotes', 'AcceptMyQuotes', 'DeclineMyQuotes', 'RenegotiateMyQuotes', 'CreateMyOrdersFromMyQuotes', 'ViewMyOrders',
    ],
  },
  {
    key: ROLE_KEYS.finance,
    name: 'Malva finance (read only)',
    buyerAssignable: true,
    permissions: ['ViewMyQuoteRequests', 'ViewOthersQuoteRequests', 'ViewMyQuotes', 'ViewOthersQuotes', 'ViewMyOrders', 'ViewOthersOrders'],
  },
];
