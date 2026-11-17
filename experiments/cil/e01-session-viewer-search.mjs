import { anonymous, gql, show } from './lib.mjs';

const s = await anonymous();
show('session response keys', Object.keys(s));
const t = s.access_token ?? s.token ?? s.session_token;
console.log('token field present:', !!t, 'expires_in:', s.expires_in);

show('viewer', (await gql(t, '{ viewer { store { key name countries } locale country currency checkoutMode presentmentOptions { __typename } } }')).json);
show('search (no filter)', (await gql(t, '{ search(first: 5) { __typename totalCount facets { __typename } edges { node { id name slug } } } }')).json);
