// Legal wording of the Broadband Facts label. PLACEHOLDERS until the owner supplies the real wording (SO-08, M-M-1).
export const LABEL_LEGAL = {
  provider: 'Malva Telecom',
  networkPolicyUrl: 'https://malva.example/network-management',
  privacyUrl: 'https://malva.example/privacy',
  supportPhone: '1-800-MALVA-00',
  supportUrl: 'https://malva.example/support',
  fccUrl: 'fcc.gov/consumer',
} as const;

/**
 * The label is a US federal disclosure format: its text is English in both locales and money uses en-US number rules
 * in the cart's currency (Planner default, flagged for the owner).
 */
export const LABEL_LOCALE = 'en-US' as const;
