// @ts-check
/**
 * ESLint custom rule: imports[] array in @Component must be in alphabetical order.
 * Auto-fix enabled.
 * Compatible with ESLint v9+ (uses context.sourceCode)
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    schema: [],
    messages: {
      wrongOrder:
        "Component imports must be in alphabetical order. '{{name}}' should come before '{{prev}}'.",
    },
  },
  create(context) {
    return {
      Decorator(node) {
        if (
          node.expression.type !== 'CallExpression' ||
          node.expression.callee.name !== 'Component'
        ) {
          return;
        }

        const args = node.expression.arguments;
        if (!args.length || args[0].type !== 'ObjectExpression') return;

        const importsProp = args[0].properties.find(
          (p) => p.type === 'Property' && (p.key?.name === 'imports' || p.key?.value === 'imports')
        );

        if (!importsProp || importsProp.value?.type !== 'ArrayExpression') return;

        const elements = importsProp.value.elements.filter(Boolean);
        if (elements.length < 2) return;

        const names = elements.map((el) => el.name ?? el.property?.name ?? context.sourceCode.getText(el));

        for (let i = 1; i < names.length; i++) {
          if (names[i].toLowerCase() < names[i - 1].toLowerCase()) {
            context.report({
              node: elements[i],
              messageId: 'wrongOrder',
              data: { name: names[i], prev: names[i - 1] },
              fix(fixer) {
                const sourceCode = context.sourceCode;
                const sorted = [...elements].sort((a, b) => {
                  const na = (a.name ?? a.property?.name ?? sourceCode.getText(a)).toLowerCase();
                  const nb = (b.name ?? b.property?.name ?? sourceCode.getText(b)).toLowerCase();
                  return na < nb ? -1 : na > nb ? 1 : 0;
                });

                const fixes = [];
                for (let j = 0; j < elements.length; j++) {
                  if (elements[j] !== sorted[j]) {
                    fixes.push(fixer.replaceText(elements[j], sourceCode.getText(sorted[j])));
                  }
                }
                return fixes;
              },
            });
            break;
          }
        }
      },
    };
  },
};
