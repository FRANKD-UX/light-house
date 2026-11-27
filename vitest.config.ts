import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/{unit,contract,integration}/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/**/*.ts',
        'static/app/src/App.tsx',
        'static/app/src/Inventory.tsx',
        'static/app/src/inventory-contract.ts',
        'static/app/src/status-contract.ts',
        'static/app/src/invocation-error.ts',
      ],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
