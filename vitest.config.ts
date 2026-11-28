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
        'static/app/src/Monitoring.tsx',
        'static/app/src/Incidents.tsx',
        'static/app/src/NocBoard.tsx',
        'static/app/src/IssueContext.tsx',
        'static/app/src/issue-context-contract.ts',
        'static/app/src/incident-contract.ts',
        'static/app/src/Operations.tsx',
        'static/app/src/operations-contract.ts',
        'static/app/src/monitoring-contract.ts',
        'static/app/src/inventory-contract.ts',
        'static/app/src/status-contract.ts',
        'static/app/src/invocation-error.ts',
      ],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
