import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          // Run unit tests before e2e tests to avoid project-level contention in CI.
          sequence: {
            groupOrder: 0,
          },
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['tests/**/*.test.ts'],
          maxWorkers: 2,
          sequence: {
            groupOrder: 1,
          },
        },
      },
    ],
  },
});
