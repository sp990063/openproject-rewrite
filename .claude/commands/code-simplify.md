---
description: Simplify code in OpenProject rewrite
---

Invoke the openproject-rewrite skill first, then use the agent-skills:code-simplification skill.

For OpenProject rewrite:
1. Follow the simplify-ignore hooks if any
2. Prioritize clarity over cleverness
3. Keep functions small and focused
4. Extract duplicated logic into shared utilities
5. Remove dead code

Do NOT simplify:
- Code with `// simplify-ignore` comments
- Complex business logic that requires the complexity
- Performance-critical paths without evidence they are bottlenecks
