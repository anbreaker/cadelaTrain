// @ts-check
/**
 * ESLint custom rule: TypeScript interface and type literal members must be
 * in alphabetical order (required before optional within the same position).
 * No auto-fix — reordering interfaces can break spread/Object.assign patterns.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    fixable: null,
    schema: [],
    messages: {
      wrongOrder:
        "'{{name}}' should come before '{{prev}}' — interface members must be in alphabetical order.",
    },
  },
  create(context) {
    function checkMembers(members) {
      for (let i = 1; i < members.length; i++) {
        const prev = members[i - 1];
        const curr = members[i];
        const prevName = (prev.key?.name ?? prev.key?.value ?? '').toLowerCase();
        const currName = (curr.key?.name ?? curr.key?.value ?? '').toLowerCase();
        if (currName < prevName) {
          context.report({
            node: curr,
            messageId: 'wrongOrder',
            data: {
              name: curr.key?.name ?? curr.key?.value,
              prev: prev.key?.name ?? prev.key?.value,
            },
          });
        }
      }
    }

    return {
      TSInterfaceBody(node) {
        checkMembers(node.body.filter((m) => m.type === 'TSPropertySignature'));
      },
      TSTypeLiteral(node) {
        checkMembers(node.members.filter((m) => m.type === 'TSPropertySignature'));
      },
    };
  },
};
