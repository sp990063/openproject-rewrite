# Phase 1 Code Review — Pages & UI (frontend/)
**Domain:** openproject-rewrite · vanilla JS SPA (NOT Next.js — the parent AGENTS.md describes the backend, this is a parallel β frontend)
**Output:** `.hermes/reports/phase1-code-review/08-pages-ui.jsonl` (90 findings, 1 per line, valid JSONL)
**Reviewer:** read-only · no mods

---

## Counts by severity
| Severity | Count |
|---|---|
| critical | 1 |
| high     | 9 |
| medium   | 16 |
| low      | 64 |
| **total** | **90** |

## Counts by file
| File | Findings |
|---|---|
| `frontend/components/primitives/index.js` | 20 |
| `frontend/router.js` | 9 |
| `frontend/query.js` | 9 |
| `frontend/components/layout/shell.js` | 9 |
| `frontend/app.js` | 8 |
| `frontend/api-client.js` | 7 |
| `frontend/store.js` | 6 |
| `frontend/pages/dashboard.js` | 5 |
| `frontend/index.html` | 3 |
| `frontend/pages/{search,my-page,help,projects/index,...}/*.js` (placeholders) | 7 |
| `frontend/test/**/*.test.js` | 5 |
| `frontend/styles/layout.css` | 1 |

---

## Top concerns (must-fix before Phase 1 ships user-controlled content)

### 1. XSS via `innerHTML` in primitives (UI-7, UI-8, UI-40, UI-41, UI-87)
- `opDialog` and `opTabs` both accept a `string` body/panel and pipe it to `innerHTML`. The JSDoc says `HTMLElement` only — the implementation is wider. Any Phase 1+ caller passing a server error message, a user name, or a wiki/wiki-renderered snippet is exposed.
- `dashboard.js` uses a local `escapeHtml` and `innerHTML` template — works today, but `escapeHtml` should be moved to a shared `frontend/lib/escape.js` with a `safeSetHTML(el, tpl, vars)` helper. Force a single audit point.
- Add a JSDoc "Security" section in `primitives/index.js` warning future devs.

### 2. CSRF + 401 redirect (UI-5, UI-6, UI-24, UI-37)
- `api-client.js` sets `X-CSRF-Token` from the NextAuth cookie — but the project's `withRoute` HOF may use a different header (the comment in `shell.js#doLogout` admits this is uncertain).
- 401 handling does a full `location.href` reload, breaking back-button and any in-flight query promises. Should use `router.navigate('/login?next=...')` and attempt a single session refresh first.
- `readCookie` will throw on malformed cookies (`100%`); the failure propagates and silently drops the CSRF header.
- `doLogout` in shell.js does GET-then-POST sign-out, but GET may 405 and the POST sends the *token* segment of the NextAuth double-submit cookie instead of the *hash* — a CSRF bypass risk on sign-out.

### 3. Router fragility (UI-1, UI-2, UI-3, UI-4, UI-33, UI-34, UI-35, UI-67, UI-70, UI-90)
- `app.js#extractParams` reaches into `router._extractParams` (private) and falls back to a hard-coded `_publicPatterns` list — adding a route + forgetting to update the list = `params.projectId === undefined` silently. **This is the #1 maintenance landmine.**
- `navigate()` short-circuits same-path-different-query, breaking tab/sort/pagination updates and the URL bar.
- `popstate` listener is registered at module import with no `removeEventListener` — Vite HMR and test re-imports accumulate listeners.
- `loadPage` reads `router.currentPath()` AFTER the dynamic import resolves, racing with concurrent nav.
- `matchPath` calls `decodeURIComponent` with no try/catch — a malformed URL crashes `router.resolve()`.
- The `/` → `/dashboard` redirect uses `navigate` (pushState) instead of `replace`, breaking the back button.

### 4. Memory leaks (UI-9, UI-13, UI-14, UI-15, UI-32, UI-42, UI-60)
- `opDropdown` registers a document-level click listener on every instance with no removal — log out, log in, click around: every dropdown's listener fires forever.
- `opToastHost` re-renders the entire toast list on every signal change; also non-idempotent (two calls = two effects).
- `opTooltip` registers 4 listeners on `target` with no dispose path; table cells with tooltips leak per row.
- `opDialog` stacks: Esc closes ALL open dialogs, no focus trap.
- `Signal#subscribe` doesn't dedupe → an effect re-running in a batch can subscribe twice and fire twice.
- Pages don't return a `dispose` — listeners on `window`/`document` and effects survive unmount.

### 5. Race conditions (UI-17, UI-18, UI-19, UI-20, UI-22, UI-23, UI-32)
- `queryClient.fetchQuery` rejects deduped observers with `AbortError` if the underlying fetch is replaced — caller can't distinguish "cancelled" from "failed", leading to double-loads.
- `invalidate()` marks entries stale but never refetches (the `refetch` option is declared but unread).
- `useQuery` creates a per-entry `_dataSignal` but `fetchQuery` and `setQueryData` never write to it — a second `useQuery` consumer is invisible to subsequent mutations. This is the same bug as React Query's `setQueryData` not notifying observers.
- Dashboard, sidebar, and (future) work-package pages all do `await fetch` → `container.removeChild(loading)` with no AbortController. Navigate during the fetch → `NotFoundError` on removeChild.

### 6. Accessibility (UI-10, UI-11, UI-12, UI-26, UI-27, UI-72–UI-77, UI-80, UI-82, UI-89)
- No skip-link, no focus management on JS load, no `<main>` semantic landmark in HTML.
- `opDialog` has no focus trap — Tab can escape into the page behind.
- `opDropdown` doesn't expose `aria-expanded` / `aria-controls`; `role="menu"` / `role="menuitem"` missing.
- `opTabs` has no Arrow Left/Right keyboard navigation; `aria-controls` / `aria-labelledby` linkage missing.
- `opInput` `required` asterisk is read as literal '*' by screen readers — no `aria-required`.
- Sidebar links lack `aria-current="page"`; icons are read aloud by SR.
- `opSpinner` doesn't respect `prefers-reduced-motion`.

### 7. Mobile responsiveness (UI-59)
- Only 2 `@media` queries in the entire CSS, no mobile sidebar overlay behavior. Verify or add: `@media (max-width: 768px) { .op-sidebar { position: fixed; transform: translateX(-100%) } }`.

### 8. Test coverage gaps (UI-46–UI-58, UI-85, UI-86)
- 5 of 12 primitives untested (opDialog, opDropdown, opTabs, opToastHost, opTooltip, opCard). The opDialog XSS surface is the highest-risk untested area.
- `useQuery` dataSignal bug (UI-19) has no test.
- No deep-link refresh test, no 401-redirect test, no back-button state test, no mobile-viewport E2E.
- No test for `invalidate` actually refetching (it doesn't — UI-18).

### 9. Placeholder pages (UI-46–UI-52)
- `search.js`, `my-page.js`, `help/index.js`, `projects/index.js`, `projects/[projectId]/index.js`, `projects/[projectId]/work-packages/index.js` are all `opEmpty("coming in Phase X")` stubs.
- `+ New Project` button in `projects/index.js` and `dashboard.js` navigates to `/projects/new` — not a registered route, 404.
- `help/index.js` advises users to "use the existing Next.js /help pages via the URL bar" — broken in the SPA-fallback (Vite serves index.html, not the Next.js page).
- `_placeholder.js` is a 2-line comment-only dead file.

---

## Recommended fix order
1. **Critical:** UI-1 (router param extraction), UI-7 + UI-8 (XSS sinks in primitives), UI-41 (shared escape util), UI-87 (security docs).
2. **High (auth & security):** UI-5, UI-6, UI-24 (CSRF / 401 / logout), UI-9, UI-13, UI-14 (memory leaks), UI-15 (effect dedup), UI-19 (dataSignal not propagating).
3. **High (UX):** UI-2 (router same-path), UI-22, UI-23 (page abort/race), UI-10, UI-11, UI-12 (a11y primitives).
4. **Medium:** Add AbortController plumbing to page lifecycle (UI-32), add a11y tests, fix the 3 placeholder nav links (UI-49, UI-88).
5. **Low / polish:** InnerHTML→replaceChildren sweep, prefers-reduced-motion, computed returns Signal, robust cookie/URL decoding, opSelect/opTextarea parity with opInput, naming/dedup of cache keys.

---

## Verifying
```bash
wc -l /home/cwlai/openproject-rewrite/.hermes/reports/phase1-code-review/08-pages-ui.jsonl   # 90
awk -F'"severity":"' '{print $2}' …  # counts above
```

All 90 findings have unique `UI-N` ids, required fields (`id`, `severity`, `file`, `line`, `title`, `description`, `suggested_fix`), and are line-anchored to the current `main` branch source. No secrets echoed. No files modified.
