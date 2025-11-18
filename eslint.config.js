import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // Best Practices
      'no-console': 'off', // Allow console in Node.js backend
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-undef': 'error',
      'prefer-const': 'warn',
      'no-var': 'error',

      // Code Style
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'semi': ['warn', 'always'],
      'comma-dangle': ['warn', 'only-multiline'],
      'indent': ['warn', 2, { SwitchCase: 1 }],
      'linebreak-style': ['error', 'unix'],
      'no-trailing-spaces': 'warn',
      'eol-last': ['warn', 'always'],

      // ES6+
      'arrow-spacing': 'warn',
      'prefer-arrow-callback': 'warn',
      'prefer-template': 'warn',
      'object-shorthand': 'warn',

      // Async/Await
      'no-async-promise-executor': 'error',
      'require-await': 'warn',

      // Security
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    files: ['test/**/*.js', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      '*.d.ts',
    ],
  },
];
