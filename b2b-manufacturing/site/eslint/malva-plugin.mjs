// Local lint rules for the Malva storefront (malva-project-bootstrap › Lint rules enforced).
const SERVER_ONLY = /^@\/lib\/(ct(\/|$)|session)/;

const clientNoServerImports = {
  meta: { type: 'problem', schema: [], messages: { server: "A 'use client' file must not import server-only code ({{source}}). Fetch through a Route Handler with SWR." } },
  create(context) {
    let isClient = false;
    return {
      Program(node) {
        isClient = node.body.some((n) => n.type === 'ExpressionStatement' && n.directive === 'use client');
      },
      ImportDeclaration(node) {
        if (isClient && SERVER_ONLY.test(String(node.source.value))) context.report({ node, messageId: 'server', data: { source: node.source.value } });
      },
    };
  },
};

const plugin = { rules: { 'client-no-server-imports': clientNoServerImports } };
export default plugin;
