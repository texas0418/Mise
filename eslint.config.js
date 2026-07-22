const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/**', 'ios/**', 'android/**', '.expo/**'],
  },
  {
    // Deterministic guards against common LLM failure modes:
    // sprawling functions, deep nesting, and unstructured complexity.
    rules: {
      // NOTE: no 'react-hooks/purity' here (unlike sibling repos on Expo 57):
      // eslint-config-expo@10 ships eslint-plugin-react-hooks@5, which
      // predates that rule, and referencing it crashes ESLint.
      complexity: ['error', 15],
      'max-depth': ['error', 5],
      'max-lines-per-function': [
        'error',
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      'max-lines': ['error', { max: 1000, skipBlankLines: true, skipComments: true }],
    },
  },
]);
