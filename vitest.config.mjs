import { defineConfig } from 'vitest/config';

// SARA's tests only. Copied worktrees are separate candidates, not extra suites.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
