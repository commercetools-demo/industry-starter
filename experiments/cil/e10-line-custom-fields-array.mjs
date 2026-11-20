// Tries the `fields: [{ name, value }]` shape (stringified values) on the live Integration Layer,
// both as arguments and inside `input`. Test cart only.
import { anonymous, gql } from './lib.mjs';
const t = (await anonymous()).token;
const add = await gql(t, 'mutation{ addCartLine(input:{sku:"MCF-COF-COLDBREW-250-WB", quantity:1}){ cart { lines { id } } } }');
const id = add.json.data.addCartLine.cart.lines[0].id;
const tries = {
  'args: lineId + fields[{name,value}]': `mutation{ updateCartLineCustomFields(lineId:"${id}", fields:[{name:"fulfilment", value:"\\"delivery\\""}]){ id } }`,
  'input: {lineId, fields:[{name,value}]}': `mutation{ updateCartLineCustomFields(input:{lineId:"${id}", fields:[{name:"fulfilment", value:"\\"delivery\\""}]}){ userErrors{ code } } }`,
  'input: {lineId, custom:[{name,value}]}': `mutation{ updateCartLineCustomFields(input:{lineId:"${id}", custom:[{name:"fulfilment", value:"\\"delivery\\""}]}){ userErrors{ code } } }`,
  'addCartLine input: fields[{name,value}]': `mutation{ addCartLine(input:{sku:"MCF-COF-COLDBREW-250-WB", quantity:1, fields:[{name:"fulfilment", value:"\\"delivery\\""}]}){ userErrors{ code } } }`,
};
for (const [label, q] of Object.entries(tries)) {
  const r = await gql(t, q);
  console.log(`\n## ${label}\n` + JSON.stringify(r.json.errors?.map((e) => e.message) ?? r.json.data).slice(0, 500));
}
