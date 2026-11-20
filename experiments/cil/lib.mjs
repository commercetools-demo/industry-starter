// Tiny client for the Commerce Integration Layer Experience API, for experiments only.
// Hosts per https://docs.commercetools.com/commerce-integration-layer/hosts-and-authorization
export const PROJECT = 'spec-test-b2c-food';
export const REGION = 'us-central1.gcp';
export const AUTH = `https://auth.integration-layer.${REGION}.commercetools.com/${PROJECT}/main`;
export const GQL = `https://graphql.integration-layer.${REGION}.commercetools.com/${PROJECT}/main/graphql`;

export async function rest(method, path, body, token) {
  const res = await fetch(AUTH + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

/** Mint an anonymous session. presentment: { locale, currency, country }. */
export async function anonymous(presentment = { locale: 'en-US', currency: 'USD', country: 'US' }) {
  const r = await rest('POST', '/session', { grant_type: 'anonymous', ...presentment });
  if (r.status !== 200) throw new Error(`mint failed ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
}

export async function gql(token, query, variables) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

export const show = (label, v) => console.log(`\n## ${label}\n` + JSON.stringify(v, null, 2).slice(0, 3500));
