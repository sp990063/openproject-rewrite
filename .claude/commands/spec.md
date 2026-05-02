---
description: Create a spec for a new feature in OpenProject rewrite
---

Invoke the openproject-rewrite skill first, then use the agent-skills:spec-driven-development skill.

For OpenProject rewrite:
1. Check which phase the feature belongs to
2. Read the existing phase spec
3. Follow the spec template: Overview, When to Use, Process, Verification
4. Save spec to /home/cwlai/wiki/concepts/openproject-rewrite-phase{N}-spec.md

Spec must include:
- API endpoints with request/response shapes
- Database schema changes (Prisma)
- Component structure
- Authentication/authorization requirements
- Error handling
