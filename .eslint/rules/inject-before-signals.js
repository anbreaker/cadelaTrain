// @ts-check
/**
 * ESLint custom rule: inject() calls must precede all other class property definitions.
 * Auto-fix enabled — reorders properties so inject() calls come first.
 * Compatible with ESLint v9+ (uses context.sourceCode)
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    schema: [],
    messages: {
      injectAfterOther:
        "inject() call '{{name}}' must be declared before other class properties.",
    },
  },
  create(context) {
    return {
      ClassBody(node) {
        const properties = node.body.filter((m) => m.type === 'PropertyDefinition');

        const injectMembers = [];
        const otherMembers = [];

        for (const prop of properties) {
          const sourceCode = context.sourceCode;
          // Use prop.value if available, else the entire property.
          const text = sourceCode.getText(prop.value ?? prop).trim();
          // Check if it starts with inject
          if (text.startsWith('inject(') || text.startsWith('inject<')) {
            injectMembers.push(prop);
          } else {
            otherMembers.push(prop);
          }
        }

        if (!injectMembers.length || !otherMembers.length) return;

        const firstOtherIndex = Math.min(...otherMembers.map((m) => properties.indexOf(m)));

        let shouldFix = false;
        let reportingNode = null;

        for (const injectMember of injectMembers) {
          const injectIndex = properties.indexOf(injectMember);
          if (injectIndex > firstOtherIndex) {
            shouldFix = true;
            reportingNode = reportingNode || injectMember;
          }
        }

        if (shouldFix && reportingNode) {
          const name = reportingNode.key?.name ?? reportingNode.key?.value ?? 'unknown';
          context.report({
            node: reportingNode,
            messageId: 'injectAfterOther',
            data: { name },
            fix(fixer) {
              const sourceCode = context.sourceCode;
              const sorted = [...injectMembers, ...otherMembers];

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
        }
      },
    };
  },
};
