---
description: Review code before merging in OpenProject rewrite
---

Invoke the openproject-rewrite skill first, then use the agent-skills:code-review-and-quality skill.

For OpenProject rewrite:
1. Check Phase 1-6 specs are followed
2. Verify auth patterns (NextAuth.js v5, isSystemAdmin, validatePassword)
3. Check Prisma 7 patterns (@db types, transactions)
4. Verify TanStack Query usage (optimistic updates, invalidation)
5. Check Zustand store patterns
6. Ensure no App Router patterns (Pages Router only)
