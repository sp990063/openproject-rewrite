---
description: Build the next task incrementally for OpenProject rewrite
---

Invoke the openproject-rewrite skill first, then use the agent-skills:incremental-implementation and agent-skills:test-driven-development skills.

For OpenProject rewrite:
1. Pick the next pending task from tasks/todo.md
2. Read the relevant phase spec
3. Follow TDD: write failing test first, then implement
4. Verify with npm test && npm run build
5. Commit with descriptive message

Key patterns for OpenProject:
- TanStack Query for data fetching
- Zustand for UI state
- Radix UI for accessible components
- Tailwind CSS v4 for styling
