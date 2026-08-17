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
  {
    // supabase/ is Deno, not React Native. The complexity and length limits
    // above still apply to it — only module resolution differs, because Deno
    // imports dependencies by `jsr:` / `npm:` URL and there is no node_modules
    // for the resolver to look in. Turning the whole directory off instead
    // would exempt the one piece of Mise that runs unattended and decides
    // whether a paying customer gets in.
    files: ['supabase/**/*.ts'],
    rules: {
      'import/no-unresolved': 'off',
    },
  },
]);
