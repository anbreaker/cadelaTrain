// @ts-check
/**
 * ESLint custom rule: input() and signal() declarations must be in alphabetical order
 * within their respective groups.
 * No auto-fix.
 * Compatible with ESLint v9+ (uses context.sourceCode)
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    fixable: null,
    schema: [],
    messages: {
      wrongOrder:
        "'{{name}}' should come before '{{prev}}' — {{group}} must be in alphabetical order.",
    },
  },
  create(context) {
    function isInput(node) {
      const sourceCode = context.sourceCode;
      const text = sourceCode.getText(node.value ?? node);
      return (
        text.startsWith('input<') ||
        text.startsWith('input(') ||
        text.startsWith('input.required<') ||
        text.startsWith('input.required(')
      );
    }

    function isSignal(node) {
      const sourceCode = context.sourceCode;
      const text = sourceCode.getText(node.value ?? node);
      return text.startsWith('signal<') || text.startsWith('signal(');
    }

    function checkAlphabetical(members, group) {
      for (let i = 1; i < members.length; i++) {
        const prevName = (members[i - 1].key?.name ?? members[i - 1].key?.value ?? '').toLowerCase();
        const currName = (members[i].key?.name ?? members[i].key?.value ?? '').toLowerCase();
        if (currName < prevName) {
          context.report({
            node: members[i],
            messageId: 'wrongOrder',
            data: {
              name: members[i].key?.name ?? members[i].key?.value,
              prev: members[i - 1].key?.name ?? members[i - 1].key?.value,
              group,
            },
          });
        }
      }
    }

    return {
      ClassBody(node) {
        const properties = node.body.filter((m) => m.type === 'PropertyDefinition');

        const inputMembers = properties.filter(isInput);
        const signalMembers = properties.filter(isSignal);

        checkAlphabetical(inputMembers, 'input() declarations');
        checkAlphabetical(signalMembers, 'signal() declarations');
      },
    };
  },
};
