---
description: Run tests and verify the OpenProject rewrite
---

Invoke the openproject-rewrite skill first, then use the agent-skills:test-driven-development skill.

For OpenProject rewrite:
1. Run unit tests: npm test
2. Run TypeScript check: npx tsc --noEmit
3. Run build: npm run build
4. Report results

The project uses:
- Vitest for unit testing
- MSW 2.13.4 for API mocking
- TypeScript strict mode
