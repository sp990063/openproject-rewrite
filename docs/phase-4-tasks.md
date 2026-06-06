# Phase 4 — Collaboration (Sprint Plan)

**Spec:** `/home/cwlai/wiki/concepts/openproject-rewrite-phase4-spec.md` (2,193 lines)
**Status:** Fully greenfield (0 pages, 0 API routes, 0 deps installed)
**DB:** ✅ 13 Prisma models already exist (WikiPage, WikiPageVersion, Forum, ForumThread, ForumPost, ForumVote, Document, DocumentVersion, DocumentFolder, Meeting, MeetingAttendee, MeetingAgendaItem, MeetingMinutes)

## Scope by feature

| # | Feature | Models (✅ exists) | API routes (❌ missing) | UI components (❌ missing) | Notes |
|---|---------|--------------------|--------------------------|----------------------------|-------|
| 1 | **Wikis** | WikiPage + WikiPageVersion | 5 routes (CRUD + versions + restore) | WikiPageView + WikiEditor + TableOfContents + VersionHistory + slug util | Spec §2.0: **MUST use sanitization pipeline (unified + remark-parse + remark-gfm + remark-rehype + DOMPurify)** — XSS critical |
| 2 | **Forums** | Forum + ForumThread + ForumPost + ForumVote | ~6 routes (CRUD per level + lock/sticky/vote) | ForumsList + ForumThreadList + ForumMessageCard + ReplyComposer | Spec calls model "ForumMessage", DB has "ForumPost" — **spec↔code drift, follow the code** |
| 3 | **Documents** | Document + DocumentVersion + DocumentFolder | 4 routes (CRUD + folder + S3 upload) | DocumentsBrowser + FolderCard + DocumentCard + UploadDialog | **S3 + presigned URLs** — needs AWS env vars (S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY). Will create stub if env missing, full impl if present. |
| 4 | **Meetings** | Meeting + MeetingAttendee + MeetingAgendaItem + MeetingMinutes | 4 routes (CRUD + RSVP + conflict detection) | MeetingList + MeetingView + MeetingForm + ParticipantBadge | Conflict detection algorithm fully spec'd in §5.4 (overlap, travel time, working hours) |
| 5 | **Global Search** | (uses existing) | 1 route (`/api/search?q=`) | SearchBar in Topbar | Spec §8 — cross-resource FTS-like search |

## Proposed Sprints (5 sprints × 2-3 days each)

### Sprint 1: Wiki foundation (XSS-safe Markdown + CRUD)
1. Install deps: `unified remark-parse remark-gfm remark-rehype rehype-sanitize rehype-stringify isomorphic-dompurify`
2. Create `lib/markdown.ts` — `renderMarkdown(content)` with 2-step sanitization (unified→HTML, DOMPurify)
3. Add new permission strings: `wiki.view`, `wiki.edit`, `wiki.delete`, `wiki.restore`
4. API: `GET/POST /api/projects/[projectId]/wiki` (list + create)
5. API: `GET/PATCH/DELETE /api/projects/[projectId]/wiki/[slug]`
6. API: `GET /api/projects/[projectId]/wiki/[slug]/versions` + `GET /api/projects/[projectId]/wiki/[slug]/versions/[version]`
7. API: `POST /api/projects/[projectId]/wiki/[slug]/restore/[version]`
8. UI: `components/wiki/WikiList.tsx` + `WikiEditor.tsx` (RHF + Zod + Markdown preview) + `WikiPageView.tsx` (sanitized) + `VersionHistory.tsx`
9. Page: `pages/projects/[projectId]/wiki/index.tsx` + `pages/projects/[projectId]/wiki/[slug].tsx` + `[slug]/history.tsx`
10. Slug utility: `lib/slug.ts` (title → URL-safe)

### Sprint 2: Forums
1. API: `GET/POST /api/projects/[projectId]/forums` (list + create forum)
2. API: `GET/POST /api/projects/[projectId]/forums/[forumId]/threads` (list + create thread)
3. API: `GET/POST /api/projects/[projectId]/forums/[forumId]/threads/[threadId]/posts` (list + reply)
4. API: `PATCH /api/projects/[projectId]/forums/[forumId]/threads/[threadId]` (lock/sticky)
5. API: `POST /api/projects/[projectId]/forums/[forumId]/threads/[threadId]/posts/[postId]/vote`
6. UI: `components/forums/ForumsList.tsx` + `ForumThreadList.tsx` + `ForumMessageCard.tsx` + `ReplyComposer.tsx`
7. Page: `pages/projects/[projectId]/forums/index.tsx` + `[forumId]/threads/index.tsx` + `[forumId]/threads/[threadId].tsx`
8. View count tracking on GET thread
9. Permission: `forums.view`, `forums.post`, `forums.moderate`

### Sprint 3: Documents (S3 upload + folder navigation)
1. Check if S3 env vars present. If not: build local disk fallback (`/uploads/` dir, multer-style) with TODO for S3 switch
2. Install: `@aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
3. API: `POST /api/projects/[projectId]/documents/upload` (presigned URL or direct upload)
4. API: `GET/POST /api/projects/[projectId]/documents` (list + create document metadata)
5. API: `GET/PATCH/DELETE /api/projects/[projectId]/documents/[docId]`
6. API: `GET/POST /api/projects/[projectId]/document-folders` (list + create folder)
7. UI: `components/documents/DocumentsBrowser.tsx` + `FolderCard.tsx` + `DocumentCard.tsx` + `UploadDialog.tsx`
8. Page: `pages/projects/[projectId]/documents/index.tsx` + `[folderId]/index.tsx`
9. Permission: `documents.view`, `documents.upload`, `documents.delete`

### Sprint 4: Meetings (conflict detection + RSVP)
1. API: `GET/POST /api/projects/[projectId]/meetings` (with conflict detection per spec §5.4)
2. API: `GET/PATCH/DELETE /api/projects/[projectId]/meetings/[meetingId]`
3. API: `POST /api/projects/[projectId]/meetings/[meetingId]/rsvp` (accept/decline/tentative)
4. API: `POST /api/projects/[projectId]/meetings/[meetingId]/agenda` (add agenda items)
5. UI: `components/meetings/MeetingList.tsx` + `MeetingView.tsx` + `MeetingForm.tsx` (date/time picker) + `ParticipantBadge.tsx`
6. Page: `pages/projects/[projectId]/meetings/index.tsx` + `[meetingId].tsx` + `new.tsx`
7. Permission: `meetings.view`, `meetings.create`, `meetings.edit`, `meetings.rsvp`

### Sprint 5: Global Search
1. API: `GET /api/search?q=` (search across work packages, wiki, forums, documents, users)
2. Scope to projects the user is a member of
3. UI: `SearchBar` component in Topbar (replaces or augments existing)
4. Debounced query, dropdown results grouped by resource type
5. Permission: implicit (only return results from accessible projects)

## Per-sprint commit template (5 sprints × 1 commit each, + 1 phase-summary commit)

```
feat(wiki): Sprint 1 — Wiki CRUD + Markdown sanitization + version history
  - 5 API routes (list, create, get, update, delete, versions, restore)
  - 4 components (WikiList, WikiEditor, WikiPageView, VersionHistory)
  - 3 pages (list, detail, history)
  - lib/markdown.ts (unified + DOMPurify XSS-safe pipeline)
  - 4 new permission strings
```

## Out of scope (pre-existing or future)

- ❌ Don't fix pre-existing test failures (vitest 16 fail / tsc 379 — Phase 3 baseline)
- ❌ Don't refactor existing components (no touching WorkPackageTable, ProjectCard, etc.)
- ❌ Don't add new Prisma models (all 13 exist already; 0 DB work needed)
- ❌ Real-time presence/realtime updates (Phase 5/6 per roadmap)
- ❌ Email notifications on new posts/threads (Phase 5)

## Risks / unknowns

1. **S3 env vars** (Sprint 3) — may not be set in dev. Will implement local-disk fallback so the feature works either way.
2. **Search performance** (Sprint 5) — DB scan across 5 tables may be slow. Will add LIMIT 50 + simple ordering. Full FTS deferred to Phase 6.
3. **Global Search auth scope** — need to check that `usePermission` / project membership is correctly applied to search results.
4. **Slug collisions** — title-based slugs may collide within a project. `@@unique([projectId, slug])` already enforced; spec doesn't say what to do on collision. Plan: append `-2`, `-3`, etc.
5. **Versioning overhead** — every PATCH creates a new WikiPageVersion. Need to consider retention policy (keep all forever? cap at 50?). Plan: keep all for now, add retention in Phase 6.

## Approval gate

Per skill workflow: this is a multi-week phase, break into approval gates.
**Approval asked**: confirm scope above + the 5-sprint breakdown + the per-sprint commit style. Then I start Sprint 1 (Wiki).
