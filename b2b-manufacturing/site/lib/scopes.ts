/**
 * Scopes of the Frontend API client (apiRoot) and of the provisioning client, each with the reason it is needed.
 * `.env.example` documents the same list; lib/scopes.test.ts keeps both in step. Scope names carry `:<projectKey>` in CTP_SCOPES.
 */
export const FRONTEND_SCOPES: Record<string, string> = {
  view_project_settings: 'Project read for the health check and locale validation',
  view_published_products: 'Service pages, listings and Product Search',
  view_categories: 'The Plumbing and Waste management categories',
  view_product_selections: 'Store product selection (mpw-all-services)',
  view_stores: 'Resolve the default store and its channels',
  view_shipping_methods: 'The zero-rate shipping method a cart needs',
  view_tax_categories: 'Tax categories attached to services',
  view_types: 'Custom types for line, request, customer and company fields',
  create_anonymous_token: 'Anonymous quote list before sign-in',
  manage_customers: 'Registration, sign-in and profile (password flow)',
  manage_orders: 'Carts of the quote list (carts share the orders scope)',
  manage_quote_requests: 'Quote requests created from carts',
  view_quotes: 'Quotes returned to the client in the portal',
  manage_quotes: 'Accept, decline or renegotiate an issued quote (accepting creates the order from the quote)',
  manage_business_units: 'Portal administrators edit sites and team (workstream S)',
  view_associate_roles: 'Role names in the team screen',
  manage_key_value_documents: 'Demo portal data (visits, waste documents, invoices) and the durable rate-limit counters, both kept as Custom Objects',
};

export const PROVISIONING_SCOPES: Record<string, string> = {
  manage_business_units: 'Create the Company, activate it, assign store and administrator at registration',
  manage_customers: 'Create the registering customer and verify the email address',
  view_stores: 'Resolve store mpw-web',
  view_associate_roles: 'Resolve the mpw-admin role',
};

export const withProject = (scopes: Record<string, string>, projectKey: string): string => Object.keys(scopes).map((s) => `${s}:${projectKey}`).join(' ');
