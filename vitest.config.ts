import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'static/app/src/App.tsx'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
