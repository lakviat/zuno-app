const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expo,
  {
    ignores: [
      'dist/**',
      'public/maplibre/**',
      '.expo/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
]);
