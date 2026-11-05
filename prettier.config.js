import prettierPluginCssOrder from 'prettier-plugin-css-order';
import prettierPluginOrganizeAttributes from 'prettier-plugin-organize-attributes';
import prettierPluginSortJson from 'prettier-plugin-sort-json';

export default {
  arrowParens: 'always',
  bracketSameLine: false,
  bracketSpacing: true,
  cssDeclarationSorterOrder: 'alphabetical',
  endOfLine: 'auto',
  htmlWhitespaceSensitivity: 'ignore',
  attributeGroups: [
    '^class$', // Class always first
    '$DEFAULT', // Normal attributes (id, type, aria-*, etc.)
    '^\\*', // Structural directives (*ngIf, *ngFor)
    '^\\[', // Inputs ([value], [disabled])
    '^\\[\\(', // Two-way bindings ([(ngModel)])
    '^\\(', // Outputs ((click), (change))
  ], // Organize attributes sorting
  attributeSort: 'ASC', // Alphabetical sort
  overrides: [
    { files: '*.component.html', options: { parser: 'angular' } },
    { files: '*.ts', options: { parser: 'typescript' } },
    { files: '*.css', options: { parser: 'css' } },
  ],
  plugins: [prettierPluginCssOrder, prettierPluginSortJson, prettierPluginOrganizeAttributes],
  printWidth: 100,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  useTabs: false,
};
