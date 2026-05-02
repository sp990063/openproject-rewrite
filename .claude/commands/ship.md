---
description: Ship completed work from OpenProject rewrite phase
---

Invoke the openproject-rewrite skill first, then use the agent-skills:shipping-and-launch skill.

For OpenProject rewrite:
1. Verify all tests pass
2. Verify build succeeds
3. Verify TypeScript has no errors
4. Run code review checks
5. Update remaining-issues.md if any issues were fixed
6. Commit with conventional commits format

Before shipping a phase:
1. Update phase status in phases-roadmap.md
2. Ensure all deliverables are complete
3. Update the project wiki if needed
