import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

/**
 * Flat ESLint config (ESLint 10). Written as .js (not .ts) to avoid the jiti
 * dependency required for TypeScript config loading.
 *
 * Layering:
 *  1. global ignores
 *  2. JS recommended
 *  3. typescript-eslint recommended (type-aware where useful)
 *  4. eslint-plugin-vue flat/recommended (SFC parsing via vue-eslint-parser)
 *  5. wire the <script> blocks of .vue files to the TS parser
 *  6. project-specific privacy/security guardrail rules
 *  7. prettier LAST to disable conflicting stylistic rules
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'node_modules/**',
      '**/*.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
  },

  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'vue/multi-word-component-names': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
    },
  },

  // Node-side config/build/test-tooling files.
  {
    files: [
      'vite.config.ts',
      'playwright.config.ts',
      'config/**/*.ts',
      'scripts/**/*.ts',
      'tests/e2e/**/*.ts',
      'tests/helpers/**/*.ts',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Test files may use console freely and the test globals.
  {
    files: ['tests/**/*.ts', 'src/**/*.spec.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-console': 'off',
    },
  },

  prettier,
)
