// @ts-check
/**
 * ESLint custom rule: enforce property order in @Component decorator
 * Auto-fix enabled — reorders properties to match defined order.
 * Compatible with ESLint v9+ (uses context.sourceCode)
 */

const DEFAULT_ORDER = [
  'standalone',
  'changeDetection',
  'encapsulation',
  'imports',
  'providers',
  'selector',
  'styleUrl',
  'styleUrls',
  'styles',
  'templateUrl',
  'template',
  'animations',
  'host',
  'inputs',
  'outputs',
  'exportAs',
  'queries',
];

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          order: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      wrongOrder:
        "Property '{{actual}}' should come before '{{expected}}' in @Component decorator.",
    },
  },
  create(context) {
    const order = context.options[0]?.order ?? DEFAULT_ORDER;

    function getOrderIndex(name) {
      const idx = order.indexOf(name);
      return idx === -1 ? order.length : idx;
    }

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

        const properties = args[0].properties.filter((p) => p.type === 'Property');
        if (properties.length < 2) return;

        for (let i = 1; i < properties.length; i++) {
          const prev = properties[i - 1];
          const curr = properties[i];
          const prevName = prev.key?.name ?? prev.key?.value;
          const currName = curr.key?.name ?? curr.key?.value;

          if (getOrderIndex(prevName) > getOrderIndex(currName)) {
            context.report({
              node: curr,
              messageId: 'wrongOrder',
              data: { actual: currName, expected: prevName },
              fix(fixer) {
                const sourceCode = context.sourceCode;
                const sorted = [...properties].sort(
                  (a, b) =>
                    getOrderIndex(a.key?.name ?? a.key?.value) -
                    getOrderIndex(b.key?.name ?? b.key?.value)
                );

                const fixes = [];
                for (let j = 0; j < properties.length; j++) {
                  const original = properties[j];
                  const replacement = sorted[j];
                  if (original !== replacement) {
                    fixes.push(
                      fixer.replaceText(original, sourceCode.getText(replacement))
                    );
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
