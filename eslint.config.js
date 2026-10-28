import js from '@eslint/js';
import globals from 'globals';
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', 'Admin/**', 'Frontend/**', 'Backend/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-control-regex': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { files: ['server/tests/**'], languageOptions: { globals: globals.jest } },
];
