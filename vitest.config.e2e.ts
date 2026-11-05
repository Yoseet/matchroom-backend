import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: { NODE_ENV: 'test', AUTH_RETURN_RESET_TOKEN: 'true' },
  },
});
