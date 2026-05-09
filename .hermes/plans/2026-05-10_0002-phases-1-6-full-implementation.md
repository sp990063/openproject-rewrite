# OpenProject Rewrite — Phase 1-6 完整執行計劃
**Goal:** 100% 功能複製 OpenProject 原版所有功能，附完整測試覆蓋  
**Created:** 2026-05-10  
**Status:** 執行中

---

## 📊 現狀評估

### 現有 Phase 狀態

| Phase | 內容 | 現有功能 | 差距 |
|-------|------|---------|------|
| **Phase 1** | Foundation（Auth/Projects/WP/Users）| ✅ 85% | OAuth/LDAP/2FA/RBAC 差距大 |
| **Phase 2** | Work Package Views（Gantt/Board/Calendar）| ✅ 90% | Backlogs 完全缺失 |
| **Phase 3** | Collaboration（Wiki/Forum/Docs/Meetings）| ✅ 80% | News/版本管理缺失 |
| **Phase 4** | Time/Costs/Notifications | ✅ 70% | Budgets/EVM/Email Digest 缺失 |
| **Phase 5** | Enterprise（LDAP/OAuth/2FA/Custom Fields）| ❌ 0% | 完全未開始 |
| **Phase 6** | Advanced（Backlogs/Reporting/Integrations）| ❌ 0% | 完全未開始 |

### 現有測試覆蓋（563 tests / 27 files）

```
✅ 已覆蓋：
- Work Package (Table/Board/Calendar/Gantt views) — 90+ tests
- Wiki (editor/view/list/version history) — 20+ tests
- Forum (CRUD/threads/posts) — 15+ tests
- Notifications — 12+ tests
- Time Tracking — 8+ tests
- Auth/API routes — 50+ tests

❌ 完全未覆蓋：
- Backlogs (Sprint Planning) — 0 tests
- Custom Fields — 0 tests
- RBAC permission checks — 0 tests
- LDAP/OAuth/2FA — 0 tests
- Budgets/EVM — 0 tests
- Webhooks — 0 tests
- Repository integration — 0 tests
- News module — 0 tests
- Version/Roadmap — 0 tests
- Project templates/copy/archive — 0 tests
- PDF/CSV export — 0 tests
- Watchers — 0 tests
- My Page advanced widgets — 0 tests
- Search advanced features — 0 tests
```

---

## 🏗️ 第一階段：身份認証與授權（第 1-8 周）

### Phase 1.1: OAuth 2.0 SSO（Google + GitHub）
**預計工時：** 3-4 天

**核心檔案變動：**
- `lib/auth.ts` — 添加 OAuth providers
- `pages/login.tsx` — OAuth 登入按鈕
- `pages/api/auth/[...nextauth].ts` — OAuth callback routes

**測試目標（24 tests）：**
```
__tests__/auth/oauth-google.test.ts
  ├── OAuth Google flow: redirect to Google ✅
  ├── OAuth Google callback: create/link account ✅
  ├── OAuth Google: existing user link account ✅
  ├── OAuth Google: new user auto-create ✅
  ├── OAuth Google: invalid state token rejection ✅
  └── OAuth Google: token refresh handling ✅

__tests__/auth/oauth-github.test.ts (same 6 patterns)
__tests__/auth/oauth-helpers.test.ts
  ├── generateStateToken: creates valid CSRF token ✅
  ├── verifyStateToken: accepts valid token ✅
  ├── verifyStateToken: rejects expired token (>10min) ✅
  ├── verifyStateToken: rejects tampered token ✅
  └── getOAuthUserInfo: parses GitHub/Google user info ✅
```

**測試工具：** `vi.mock('next-auth/react')` + `nock`  mock OAuth provider HTTP calls

---

### Phase 1.2: LDAP 認証與群組同步
**預計工時：** 5-7 天

**核心檔案變動：**
- `lib/ldap/client.ts` — LDAP bind/search
- `lib/ldap/sync.ts` — user import + group mapping
- `lib/ldap/group-map.ts` — LDAP group → role mapping
- `pages/api/auth/ldap.ts` — LDAP login endpoint
- `pages/api/ldap/groups.ts` + `pages/api/ldap/group-mappings.ts`
- `pages/admin/ldap-settings.tsx` — Admin LDAP 配置 UI
- `prisma/schema.prisma` — 添加 `LdapGroupMapping` model

**測試目標（38 tests）：**
```
__tests__/lib/ldap/client.test.ts
  ├── ldapBind: successful connection ✅
  ├── ldapBind: invalid credentials throws ✅
  ├── ldapSearch: finds user by uid ✅
  ├── ldapSearch: finds users by group DN ✅
  ├── ldapSearch: handles connection timeout ✅
  └── ldapSearch: handles LDAP referral chasing ✅

__tests__/lib/ldap/sync.test.ts
  ├── syncUsers: imports new users from LDAP ✅
  ├── syncUsers: updates existing users ✅
  ├── syncUsers: deactivates missing users ✅
  ├── syncUsers: applies group-to-role mapping ✅
  ├── syncUsers: handles group mapping conflict ✅
  ├── syncUsers: batch processes large user sets (>1000) ✅
  └── syncUsers: transaction rollback on error ✅

__tests__/lib/ldap/group-map.test.ts
  ├── mapUserToRoles: single group maps to Member ✅
  ├── mapUserToRoles: multiple groups union roles ✅
  ├── mapUserToRoles: no match uses default role ✅
  └── resolveGroupDN: handles nested LDAP groups ✅

__tests__/api/auth/ldap.test.ts
  ├── POST /api/auth/ldap: valid credentials returns JWT ✅
  ├── POST /api/auth/ldap: invalid LDAP password returns 401 ✅
  ├── POST /api/auth/ldap: user not in LDAP returns 401 ✅
  └── POST /api/auth/ldap: rate limited after 5 attempts ✅

__tests__/api/ldap/group-mappings.test.ts
  ├── GET /api/ldap/group-mappings: returns all mappings ✅
  ├── POST /api/ldap/group-mappings: creates mapping ✅
  ├── PUT /api/ldap/group-mappings/[id]: updates mapping ✅
  ├── DELETE /api/ldap/group-mappings/[id]: removes mapping ✅
  └── GET /api/ldap/groups: returns LDAP group list ✅
```

**測試工具：** `ldapjs` mock server（`ldif-mock-server`）+ `vi.mock`

---

### Phase 1.3: 雙重驗證（2FA）
**預計工時：** 4-5 天

**核心檔案變動：**
- `lib/2fa/totp.ts` — TOTP generation/verification
- `lib/2fa/backup-codes.ts` — backup codes generation
- `lib/2fa/webauthn.ts` — U2F/WebAuthn registration/assertion
- `pages/api/users/[id]/2fa/setup.ts` + `verify.ts` + `disable.ts`
- `pages/api/users/[id]/2fa/webauthn/register.ts` + `assert.ts`
- `components/auth/TwoFactorSetupDialog.tsx`
- `components/auth/TwoFactorInput.tsx`
- `pages/settings/security.tsx`

**測試目標（42 tests）：**
```
__tests__/lib/2fa/totp.test.ts
  ├── generateTOTPSecret: creates 20-byte base32 secret ✅
  ├── generateTOTPURI: creates valid otpauth:// URI ✅
  ├── generateTOTPURI: includes account name and issuer ✅
  ├── verifyTOTP: accepts valid 6-digit code ✅
  ├── verifyTOTP: rejects invalid code ✅
  ├── verifyTOTP: allows 30s clock skew ✅
  ├── verifyTOTP: rejects code from wrong window (±2 periods) ✅
  └── generateBackupCodes: creates 10 hashed codes ✅

__tests__/lib/2fa/backup-codes.test.ts
  ├── generateBackupCodes: returns 10 unique codes ✅
  ├── generateBackupCodes: codes are 10 chars alphanumeric ✅
  ├── verifyBackupCode: accepts valid code ✅
  ├── verifyBackupCode: deletes code after use ✅
  ├── verifyBackupCode: rejects already-used code ✅
  ├── verifyBackupCode: case-insensitive ✅
  └── hashBackupCode: different salt each time ✅

__tests__/lib/2fa/webauthn.test.ts
  ├── generateRegistrationOptions: creates valid options ✅
  ├── verifyRegistrationResponse: validates attestation ✅
  ├── generateAssertionOptions: creates challenge ✅
  └── verifyAssertionResponse: validates signature ✅

__tests__/api/users/2fa.test.ts
  ├── POST /api/users/[id]/2fa/setup: generates secret + QR ✅
  ├── POST /api/users/[id]/2fa/setup: requires re-auth ✅
  ├── POST /api/users/[id]/2fa/verify: enables 2FA ✅
  ├── POST /api/users/[id]/2fa/disable: requires password ✅
  ├── POST /api/users/[id]/2fa/disable: rejects wrong password ✅
  └── GET /api/users/[id]/2fa/status: returns 2FA enabled status ✅

__tests__/api/auth/2fa-login.test.ts
  ├── login with 2FA: shows 2FA step after password ✅
  ├── login 2FA: accepts valid TOTP code ✅
  ├── login 2FA: rejects invalid TOTP code ✅
  ├── login 2FA: account locked after 5 wrong attempts ✅
  ├── login 2FA: backup codes work once each ✅
  ├── login 2FA: backup codes deleted after use ✅
  └── login 2FA: U2F security key works ✅

__tests__/components/auth/2fa-setup-dialog.test.tsx
  ├── renders QR code ✅
  ├── shows backup codes after setup ✅
  ├── enables 2FA button disabled until code verified ✅
  ├── copy backup codes button ✅
  └── error state: invalid code rejected ✅
```

---

### Phase 1.4: 密碼重置 + 用戶邀請 + GDPR
**預計工時：** 3-4 天

**測試目標（28 tests）：**

```
__tests__/api/auth/password-reset.test.ts
  ├── POST /api/auth/forgot-password: sends email ✅
  ├── POST /api/auth/forgot-password: rate limited (3/hour) ✅
  ├── POST /api/auth/forgot-password: returns 200 even if user not found ✅
  ├── POST /api/auth/reset-password: accepts valid token ✅
  ├── POST /api/auth/reset-password: rejects expired token (>24h) ✅
  ├── POST /api/auth/reset-password: rejects tampered token ✅
  └── POST /api/auth/reset-password: requires minimum password strength ✅

__tests__/api/users/invite.test.ts
  ├── POST /api/users/invite: sends invite email ✅
  ├── POST /api/users/invite: creates pending user ✅
  ├── POST /api/users/invite: existing email links to project ✅
  ├── POST /api/users/accept-invite: sets password + activates ✅
  ├── POST /api/users/accept-invite: rejects expired token ✅
  └── POST /api/users/accept-invite: rejects used token ✅

__tests__/api/users/anonymize.test.ts
  ├── DELETE /api/users/[id]: soft deletes ✅
  ├── POST /api/users/[id]/anonymize: replaces PII ✅
  ├── POST /api/users/[id]/anonymize: cascades to all relations ✅
  └── GET /api/users/[id]: returns 404 after anonymization ✅
```

---

### Phase 1.5: 細粒度 RBAC 權限系統
**預計工時：** 7-10 天（最大工作量之一）

**核心檔案變動：**
- `prisma/schema.prisma` — Role, Permission, ProjectRole, FieldPermission models
- `lib/rbac/can.ts` — 核心 `can()` 函數
- `lib/rbac/check.ts` — API middleware
- `lib/rbac/field-filter.ts` — 欄位級過濾
- `lib/rbac/hooks.ts` — `usePermission` hook
- `prisma/seed-roles.ts` — seed 內置角色

**測試目標（72 tests）：**

```
__tests__/lib/rbac/can.test.ts
  ├── can: admin can do everything ✅
  ├── can: non-member cannot access project resources ✅
  ├── can: member can read own work packages ✅
  ├── can: member cannot delete others' work packages ✅
  ├── can: project admin can delete work packages in project ✅
  ├── can: role with only read_work_packages ✅
  ├── can: field-level write restriction ✅
  ├── can: applies to project-scoped resource ✅
  ├── can: global role overrides project role ✅
  ├── can: cached permission for same user/resource ✅
  └── can: cache invalidation on role change ✅

__tests__/lib/rbac/field-filter.test.ts
  ├── filterFields: removes hidden fields from response ✅
  ├── filterFields: keeps readable fields ✅
  ├── filterFields: respects custom field permissions ✅
  └── filterFields: handles nested resources ✅

__tests__/lib/rbac/hooks.test.ts
  ├── usePermission: returns true for allowed action ✅
  ├── usePermission: returns false for denied action ✅
  ├── usePermission: refetches on project change ✅
  └── usePermission: cached result prevents re-renders ✅

__tests__/lib/rbac/seed-roles.test.ts
  ├── seedRoles: creates all 5 built-in roles ✅
  ├── seedRoles: admin role has all permissions ✅
  ├── seedRoles: non_member role has minimal permissions ✅
  ├── seedRoles: idempotent (no duplicate roles) ✅
  └── getDefaultRole: returns 'member' for new users ✅

__tests__/api/rbac/middleware.test.ts
  ├── withPermission: allows authorized request ✅
  ├── withPermission: rejects unauthorized with 403 ✅
  ├── withPermission: rejects unauthenticated with 401 ✅
  ├── withPermission: project-scoped permission checks project membership ✅
  └── withPermission: field-level permission filters response ✅

__tests__/api/rbac/all-routes.test.ts (integration)
  ├── all write routes: return 401 without session ✅
  ├── all write routes: return 403 without permission ✅
  ├── GET routes: return 403 for hidden resources ✅
  └── admin routes: only accessible by system admin ✅

__tests__/pages/admin/roles.test.tsx
  ├── renders role list ✅
  ├── renders permission matrix ✅
  ├── editing role: saves permission changes ✅
  └── validates: cannot remove all admin permissions ✅
```

**測試策略：**
- Unit test `can()` function with all combinations of roles × resources × actions
- Integration test every API route with authorized/unauthorized permutations
- Use `auth.getMockSession()` helper for testing with different roles

---

### Phase 1.6: User Profile + Account Settings
**預計工時：** 2-3 天

**測試目標（18 tests）：**

```
__tests__/pages/settings/account.test.tsx
  ├── renders account settings form ✅
  ├── updates display name ✅
  ├── updates language preference ✅
  ├── avatar upload: accepts JPG/PNG ✅
  ├── avatar upload: rejects invalid file type ✅
  ├── password change: validates current password ✅
  ├── password change: rejects weak new password ✅
  └── email change: sends verification email ✅

__tests__/api/users/profile.test.ts
  ├── GET /api/users/me: returns current user ✅
  ├── PUT /api/users/me: updates profile ✅
  └── PUT /api/users/me/avatar: uploads avatar ✅
```

---

## 🚀 第二階段：工作包增強（第 9-18 周）

### Phase 2.1: Backlogs（Sprint Planning）— 最大功能缺口
**預計工時：** 14-18 天

**核心檔案變動：**
- `prisma/schema.prisma` — Sprint, BacklogItem, SprintRelation models
- `pages/api/backlogs/` — 完整的 REST API
- `pages/projects/[projectId]/backlogs/index.tsx` — Backlog 主頁
- `components/backlogs/` — 所有 Backlog 相關 components

**測試目標（96 tests）:**

```
# === Unit Tests ===

__tests__/lib/backlogs/scheduling-engine.test.ts
  ├── calculateSprintVelocity: correct sum of story points ✅
  ├── calculateSprintVelocity: ignores completed items ✅
  ├── calculateIdealBurndown: linear ideal line ✅
  ├── calculateActualBurndown: daily completion data ✅
  ├── calculateRemainingWork: aggregates incomplete items ✅
  ├── schedulingEngine: handles empty sprint ✅
  ├── schedulingEngine: respects story points capacity ✅
  ├── schedulingEngine: moves overflow to next sprint ✅
  └── detectSprintRisks: warns when >80% capacity ✅

__tests__/lib/backlogs/burndown-calculator.test.ts
  ├── generates daily remaining points ✅
  ├── handles days with no completions ✅
  ├── handles sprint start before today ✅
  ├── weekend handling: skip non-working days ✅
  └── missing data interpolation ✅

# === API Tests ===

__tests__/api/backlogs/crud.test.ts
  ├── GET /api/backlogs: lists all backlogs for project ✅
  ├── POST /api/backlogs: creates new backlog ✅
  ├── POST /api/backlogs: creates sprint with name/dates ✅
  ├── GET /api/backlogs/[id]: gets backlog with items ✅
  ├── PUT /api/backlogs/[id]: updates sprint details ✅
  ├── DELETE /api/backlogs/[id]: deletes empty backlog ✅
  ├── DELETE /api/backlogs/[id]: rejects if has items ✅
  └── PUT /api/backlogs/[id]/items/reorder: updates order ✅

__tests__/api/backlogs/items.test.ts
  ├── POST /api/backlogs/[id]/items: creates backlog item ✅
  ├── POST /api/backlogs/[id]/items: supports all types (Story/Task/Bug) ✅
  ├── PUT /api/backlogs/[id]/items/[itemId]: updates item ✅
  ├── PUT /api/backlogs/[id]/items/[itemId]: updates story points ✅
  ├── DELETE /api/backlogs/[id]/items/[itemId]: removes item ✅
  ├── POST /api/backlogs/[id]/items/[itemId]/to-sprint: moves to sprint ✅
  ├── POST /api/backlogs/[id]/items/[itemId]/to-backlog: moves to backlog ✅
  └── POST /api/backlogs/[id]/items/[itemId]/split: splits story into tasks ✅

__tests__/api/backlogs/sprint-lifecycle.test.ts
  ├── POST /api/backlogs/[id]/start: locks sprint ✅
  ├── POST /api/backlogs/[id]/start: records start date ✅
  ├── POST /api/backlogs/[id]/start: calculates initial velocity ✅
  ├── POST /api/backlogs/[id]/close: calculates final velocity ✅
  ├── POST /api/backlogs/[id]/close: incomplete items option: next sprint ✅
  ├── POST /api/backlogs/[id]/close: incomplete items option: back to backlog ✅
  ├── GET /api/backlogs/[id]/burndown: returns complete burndown data ✅
  └── GET /api/backlogs/velocity: returns historical velocities ✅

__tests__/api/backlogs/permissions.test.ts
  ├── create sprint: requires project admin ✅
  ├── move item to sprint: requires sprint permission ✅
  ├── edit backlog item: requires edit permission ✅
  └── close sprint: requires project admin ✅

# === Component Tests ===

__tests__/components/backlogs/backlog-board.test.tsx
  ├── renders split view: product backlog + sprint panel ✅
  ├── renders empty state when no backlogs ✅
  ├── renders sprint card with item count ✅
  ├── drag item from product backlog to sprint ✅
  ├── drag item within sprint changes order ✅
  ├── drag item back to product backlog ✅
  ├── shows story points badge on cards ✅
  ├── shows type icon (story/task/bug) ✅
  ├── sprint velocity card shows current velocity ✅
  └── burndown mini-chart renders ✅

__tests__/components/backlogs/sprint-panel.test.tsx
  ├── renders sprint header with name/dates ✅
  ├── renders sprint goal ✅
  ├── renders capacity bar ✅
  ├── shows item count vs capacity ✅
  ├── capacity warning at >80% ✅
  ├── "Start Sprint" button for planning sprints ✅
  ├── "Close Sprint" button for active sprints ✅
  └── collapsed state shows summary only ✅

__tests__/components/backlogs/backlog-item-card.test.tsx
  ├── renders story points badge ✅
  ├── renders type icon (Story/Task/Bug) ✅
  ├── renders priority indicator ✅
  ├── inline edit: story points click-to-edit ✅
  ├── inline edit: subject click-to-edit ✅
  ├── drag handle appears on hover ✅
  ├── children indicator for parent stories ✅
  ├── completed items: strikethrough style ✅
  └── sprint items: show sprint badge ✅

__tests__/components/backlogs/burndown-chart.test.tsx
  ├── renders SVG chart ✅
  ├── renders ideal line ✅
  ├── renders actual line ✅
  ├── renders today marker ✅
  ├── hover tooltip shows daily data ✅
  ├── empty state: no data yet ✅
  └── handles weekend gaps in data ✅

__tests__/components/backlogs/sprint-planning-dialog.test.tsx
  ├── form validation: name required ✅
  ├── form validation: start date required ✅
  ├── form validation: end date after start date ✅
  ├── creates sprint on submit ✅
  ├── shows existing sprints for reference ✅
  └── capacity planning: story points input ✅

__tests__/components/backlogs/velocity-chart.test.tsx
  ├── renders bar chart ✅
  ├── each bar = one sprint's velocity ✅
  ├── average velocity line ✅
  └── tooltip: sprint name + velocity number ✅
```

---

### Phase 2.2: Custom Fields（9種類型自定義字段）
**預計工時：** 10-14 天

**測試目標（88 tests）：**

```
# === Validation Tests ===

__tests__/lib/custom-fields/validation.test.ts
  ├── validateCustomFieldValue: STRING - max length ✅
  ├── validateCustomFieldValue: INTEGER - must be integer ✅
  ├── validateCustomFieldValue: FLOAT - accepts decimal ✅
  ├── validateCustomFieldValue: BOOLEAN - true/false ✅
  ├── validateCustomFieldValue: DATE - ISO format ✅
  ├── validateCustomFieldValue: DATE_TIME - ISO format with TZ ✅
  ├── validateCustomFieldValue: LIST - must be in possibleValues ✅
  ├── validateCustomFieldValue: MULTI_LIST - array of valid values ✅
  ├── validateCustomFieldValue: USER - must exist ✅
  ├── validateCustomFieldValue: VERSION - must exist ✅
  ├── validateCustomFieldValue: REGEX - custom pattern ✅
  ├── validateCustomFieldValue: REQUIRED - rejects empty ✅
  └── validateCustomFieldValue: DEFAULT_VALUE - applies on create ✅

# === API Tests ===

__tests__/api/custom-fields/crud.test.ts
  ├── GET /api/custom-fields: lists all custom fields ✅
  ├── POST /api/custom-fields: creates STRING type ✅
  ├── POST /api/custom-fields: creates LIST type with options ✅
  ├── POST /api/custom-fields: creates all 9 types ✅
  ├── PUT /api/custom-fields/[id]: updates definition ✅
  ├── DELETE /api/custom-fields/[id]: cascades to values ✅
  └── GET /api/custom-fields/for-resource: returns fields for work_package in project ✅

__tests__/api/custom-fields/values.test.ts
  ├── PUT /api/custom-field-values: sets value for work package ✅
  ├── PUT /api/custom-field-values: batch sets multiple fields ✅
  ├── GET /api/work-packages/[id]: includes custom field values ✅
  ├── PUT /api/custom-field-values: validates against field type ✅
  ├── PUT /api/custom-field-values: rejects value not in LIST options ✅
  └── DELETE /api/custom-field-values: removes custom field value ✅

__tests__/api/custom-fields/security.test.ts
  ├── cannot set custom field not assigned to project ✅
  ├── cannot set custom field without write permission ✅
  ├── hidden custom fields excluded from API response ✅
  └── required custom fields validated on work package create ✅

# === Component Tests ===

__tests__/components/custom-fields/input-components.test.tsx
  ├── StringField: text input with maxLength ✅
  ├── TextField: textarea renders ✅
  ├── IntegerField: number input, rejects non-integer ✅
  ├── FloatField: accepts decimal input ✅
  ├── BooleanField: checkbox renders ✅
  ├── DateField: date picker opens ✅
  ├── DateTimeField: datetime picker with timezone ✅
  ├── ListField: dropdown with options ✅
  ├── MultiListField: multi-select checkboxes ✅
  ├── UserField: user search + select ✅
  ├── VersionField: version dropdown ✅
  └── CustomFieldRenderer: routes to correct input type ✅

__tests__/components/custom-fields/table-column.test.tsx
  ├── renders custom field column in table ✅
  ├── inline edit: string field ✅
  ├── inline edit: list field dropdown ✅
  ├── column resizing ✅
  └── column sorting by custom field value ✅

__tests__/pages/admin/custom-fields.test.tsx
  ├── renders custom fields list ✅
  ├── create: type selector shows all 9 types ✅
  ├── create LIST: adds/removes options ✅
  ├── create: enables "searchable" toggle ✅
  ├── create: enables "displayed" toggle ✅
  └── delete: confirmation dialog ✅
```

---

### Phase 2.3: 工作包狀態工作流
**預計工時：** 5-7 天

**測試目標（40 tests）：**

```
__tests__/lib/workflows/transition.test.ts
  ├── canTransition: allows valid transition ✅
  ├── canTransition: rejects invalid transition ✅
  ├── canTransition: allows when no workflow defined ✅
  ├── canTransition: respects role-specific workflows ✅
  └── canTransition: allows if user is admin ✅

__tests__/api/workflows/status-workflow.test.ts
  ├── GET /api/workflows: lists all workflows ✅
  ├── POST /api/workflows: creates workflow rule ✅
  ├── PUT /api/workflows/[id]: updates transition rules ✅
  ├── DELETE /api/workflows/[id]: removes workflow ✅
  └── GET /api/types/[id]/available-statuses: returns allowed next statuses ✅

__tests__/api/work-packages/status-transition.test.ts
  ├── PATCH /api/work-packages/[id]: allows valid transition ✅
  ├── PATCH /api/work-packages/[id]: rejects invalid transition ✅
  └── PATCH /api/work-packages/[id]: returns 422 with allowed statuses ✅

__tests__/components/work-packages/status-transition.test.tsx
  ├── renders status dropdown with allowed transitions only ✅
  ├── shows "no transition available" for blocked states ✅
  └── transition modal: shows confirmation for closing ✅
```

---

### Phase 2.4: PDF/CSV 導出
**預計工時：** 4-5 天

**測試目標（24 tests）：**

```
__tests__/lib/export/csv.test.ts
  ├── generates valid CSV with headers ✅
  ├── handles special characters (commas, quotes, newlines) ✅
  ├── UTF-8 BOM for Excel compatibility ✅
  ├── includes all visible columns ✅
  ├── includes custom field values ✅
  └── streaming: works with 10000+ rows ✅

__tests__/lib/export/pdf.test.ts
  ├── generates PDF with work package data ✅
  ├── includes custom fields in PDF ✅
  ├── respects project PDF branding settings ✅
  └── handles empty work package list ✅

__tests__/api/work-packages/export.test.ts
  ├── GET /api/work-packages/export/csv: returns CSV file ✅
  ├── GET /api/work-packages/export/csv?ids=1,2,3: exports selected ✅
  ├── GET /api/work-packages/export/pdf: returns PDF file ✅
  ├── GET /api/work-packages/export/pdf: respects query filters ✅
  └── unauthorized: requires view permission ✅

__tests__/api/work-packages/atom-feed.test.ts
  ├── GET /api/work-packages/feed: returns valid Atom XML ✅
  ├── Atom feed: includes updated timestamp ✅
  └── Atom feed: pagination works ✅
```

---

### Phase 2.5: 工作包 Watchers
**預計工時：** 3-4 天

**測試目標（24 tests）：**

```
__tests__/api/work-packages/watchers.test.ts
  ├── GET /api/work-packages/[id]/watchers: lists watchers ✅
  ├── POST /api/work-packages/[id]/watchers: adds watcher ✅
  ├── DELETE /api/work-packages/[id]/watchers/[userId]: removes ✅
  ├── POST /api/work-packages/[id]/watchers: cannot watch twice ✅
  └── notifications sent to watchers on WP update ✅

__tests__/components/work-packages/watcher-list.test.tsx
  ├── renders watcher avatars ✅
  ├── "Watch" button toggles watching state ✅
  └── "Watching" badge shows for current user ✅
```

---

### Phase 2.6: 工作包父子層級視圖
**預計工時：** 3-4 天

**測試目標（20 tests）：**

```
__tests__/lib/work-packages/scheduling.test.ts
  ├── schedules children under parent dates ✅
  ├── "decidable children" mode: ignores children for scheduling ✅
  ├── aggregates story points from children ✅
  └── hierarchical sorting in table ✅

__tests__/components/work-packages/hierarchy-tree.test.tsx
  ├── renders collapsed parent row ✅
  ├── expands to show children ✅
  ├── indentation per level ✅
  └── drag within hierarchy changes parent ✅
```

---

## 🏗️ 第三階段：項目管理增強（第 19-26 周）

### Phase 3.1: 項目模板 + 複製 + 封存
**預計工時：** 6-8 天

**測試目標（44 tests）：**

```
__tests__/api/projects/templates.test.ts
  ├── GET /api/projects/templates: lists template projects ✅
  ├── POST /api/projects/from-template: deep copies all modules ✅
  ├── POST /api/projects/from-template: remaps user references ✅
  ├── POST /api/projects/from-template: uses transaction ✅
  └── project copy: generates new IDs for all resources ✅

__tests__/api/projects/archive.test.ts
  ├── POST /api/projects/[id]/archive: sets archivedAt ✅
  ├── GET /api/projects: excludes archived by default ✅
  ├── GET /api/projects?includeArchived=true: includes archived ✅
  ├── POST /api/projects/[id]/unarchive: clears archivedAt ✅
  └── archived project: API returns 410 Gone ✅

__tests__/api/projects/subprojects.test.ts
  ├── project has parentId field ✅
  ├── GET /api/projects: returns nested tree ✅
  └── sidebar: renders project tree with expand/collapse ✅
```

---

### Phase 3.2: 版本管理（Roadmap）
**預計工時：** 4-5 天

**測試目標（24 tests）：**

```
__tests__/api/projects/versions.test.ts
  ├── GET /api/projects/[id]/versions: lists versions ✅
  ├── POST /api/projects/[id]/versions: creates version ✅
  ├── PUT /api/projects/[id]/versions/[vid]: updates version ✅
  ├── DELETE /api/projects/[id]/versions/[vid]: prevents if WPs linked ✅
  ├── POST /api/versions/[vid]/work-packages: links WP to version ✅
  └── GET /api/versions/[vid]/work-packages: lists linked WPs ✅

__tests__/components/roadmap/roadmap-timeline.test.tsx
  ├── renders timeline with versions ✅
  ├── version card: shows status badge ✅
  ├── version card: shows WP count ✅
  └── today marker on timeline ✅
```

---

### Phase 3.3: 新聞模組（News）
**預計工時：** 3-4 天

**測試目標（18 tests）：**

```
__tests__/api/projects/news.test.ts
  ├── GET /api/projects/[id]/news: lists news ✅
  ├── POST /api/projects/[id]/news: creates news ✅
  ├── PUT /api/projects/[id]/news/[nid]: updates news ✅
  ├── DELETE /api/projects/[id]/news/[nid]: removes news ✅
  └── news appears in project activity feed ✅

__tests__/components/news/news-card.test.tsx
  ├── renders title + summary + date ✅
  └── "Read more" link ✅
```

---

## 🔗 第四階段：集成與導出（第 27-34 周）

### Phase 4.1: Repository 集成 + GitHub/Jenkins
**預計工時：** 5-7 天

**測試目標（36 tests）：**

```
__tests__/lib/repositories/commit-linker.test.ts
  ├── parses #123 format in commit message ✅
  ├── parses multiple references: #123, #456 ✅
  ├── parses cross-project refs: project#123 ✅
  └── links commit to work package automatically ✅

__tests__/api/repositories/webhook.test.ts
  ├── POST /api/repositories/webhook: GitHub push event ✅
  ├── POST /api/repositories/webhook: GitLab push event ✅
  ├── POST /api/repositories/webhook: creates commit record ✅
  └── commit linked to WP via message parsing ✅

__tests__/api/integrations/github.test.ts
  ├── POST /api/integrations/github/status: updates commit status ✅
  └── GitHubStatusBadge: renders check/x/pending ✅
```

---

### Phase 4.2: Webhook 系統
**預計工時：** 5-6 天

**測試目標（32 tests）：**

```
__tests__/lib/webhooks/dispatcher.test.ts
  ├── dispatches to registered webhooks ✅
  ├── dispatches to multiple URLs in parallel ✅
  ├── excludes disabled webhooks ✅
  ├── retries on failure (3 attempts) ✅
  └── logs delivery result ✅

__tests__/lib/webhooks/delivery.test.ts
  ├── HTTP POST with JSON payload ✅
  ├── includes HMAC signature header ✅
  ├── exponential backoff on failure ✅
  └── timeout after 30s ✅

__tests__/api/projects/webhooks.test.ts
  ├── CRUD webhooks ✅
  ├── GET /api/webhooks/[id]/deliveries: lists deliveries ✅
  ├── POST /api/webhooks/[id]/test: sends test payload ✅
  └── webhook secret regeneration ✅
```

---

### Phase 4.3: Email 通知增強（Instant + Digest）
**預計工時：** 4-5 天

**測試目標（24 tests）：**

```
__tests__/lib/email/notification-email.test.ts
  ├── renders HTML email for work package update ✅
  ├── renders HTML email for mention ✅
  ├── includes unsubscribe link ✅
  └── plain text fallback ✅

__tests__/lib/email/digest.test.ts
  ├── aggregates notifications for daily digest ✅
  ├── groups notifications by project ✅
  ├── respects user's digest frequency ✅
  └── generates digest email HTML ✅

__tests__/api/cron/digest.test.ts
  ├── cron: sends digest to users with daily preference ✅
  ├── cron: sends digest at user's preferred time ✅
  └── cron: skips users with no notifications ✅
```

---

### Phase 4.4: Budgets / 成本管理 + EVM
**預計工時：** 5-6 天

**測試目標（32 tests）：**

```
__tests__/lib/budgets/evm.test.ts
  ├── calculatePV: planned value from baseline ✅
  ├── calculateEV: earned value from % complete ✅
  ├── calculateAC: actual cost from time entries ✅
  ├── calculateSPI: SPI = EV/PV ✅
  ├── calculateCPI: CPI = EV/AC ✅
  └── generates daily EVM data points ✅

__tests__/api/budgets.test.ts
  ├── CRUD budgets ✅
  ├── budget: aggregates cost entries ✅
  └── GET /api/projects/[id]/cost-reports: EVM report ✅

__tests__/components/budgets/evm-chart.test.tsx
  ├── renders SPI/CPI trend line ✅
  └── threshold markers at SPI=1.0 ✅
```

---

## 🔐 第五階段：企業級功能（第 35-42 周）

### Phase 5.1: 全域系統設置 + Announcements
**預計工時：** 2-3 天

**測試目標（16 tests）：**

```
__tests__/api/admin/settings.test.ts
  ├── CRUD system settings ✅
  └── settings validated against schema ✅

__tests__/api/announcements.test.ts
  ├── announcements shown in layout ✅
  └── expired announcements auto-hidden ✅
```

---

### Phase 5.2: Wiki 增強（表情/標籤/討論）
**預計工時：** 3-4 天

**測試目標（20 tests）：**

```
__tests__/api/wiki/reactions.test.ts
  ├── POST /api/wiki/[id]/reactions: adds reaction ✅
  ├── DELETE /api/wiki/[id]/reactions/[emoji]: removes ✅
  └── aggregated reaction counts ✅

__tests__/api/wiki/tags.test.ts
  ├── CRUD tags ✅
  └── tags shown on wiki pages ✅
```

---

### Phase 5.3: Forum 增強（投票/最佳答案）
**預計工時：** 3-4 天

**測試目標（20 tests）：**

```
__tests__/api/forums/voting.test.ts
  ├── POST vote: upvotes thread ✅
  ├── DELETE vote: removes vote ✅
  └── vote count aggregated ✅

__tests__/api/forums/accepted-answer.test.ts
  ├── POST accept: marks answer ✅
  └── only thread author can accept ✅
```

---

### Phase 5.4: 高級搜索保存 + Alert
**預計工時：** 3-4 天

**測試目標（16 tests）：**

```
__tests__/api/searches/saved-search.test.ts
  ├── CRUD saved searches ✅
  └── saved search appears in My Page ✅

__tests__/api/cron/search-alerts.test.ts
  └── new results trigger notification ✅
```

---

### Phase 5.5: My Page Widget 擴展 + 拖放佈局
**預計工時：** 4-5 天

**測試目標（24 tests）：**

```
__tests__/components/my-page/widget-drag-drop.test.tsx
  ├── widgets are draggable ✅
  ├── drop: reorders widgets ✅
  └── layout persisted to database ✅

__tests__/components/my-page/new-widgets.test.tsx
  ├── DocumentsWidget renders ✅
  ├── BudgetWidget renders ✅
  └── WikiChangesetsWidget renders ✅
```

---

### Phase 5.6: Meeting PDF/ICS + 用戶群組
**預計工時：** 3-4 天

**測試目標（20 tests）：**

```
__tests__/lib/meetings/ics.test.ts
  ├── generates valid ICS file ✅
  ├── ICS: correct VEVENT format ✅
  └── ICS: includes attendees ✅

__tests__/api/groups.test.ts
  ├── CRUD groups ✅
  └── assign group to work package ✅
```

---

## 📊 第五 + 六階段：測試覆蓋 + 文檔（第 43-48 周）

### Phase 6.1: 補充所有缺失測試
**目標：**
- 所有 API routes：每個 route 起碼 1 個 happy path + 1 個 error path
- 所有 components：每個 component 起碼 render test + interaction test
- 所有 hooks：每個 hook 起碼 query success + error + loading states
- 所有 lib 函數：100% branch coverage

**補充測試（~200 tests）：**

```
# 現有覆蓋不足的領域：
- components/projects/ (member-list, module-toggle, project-card) — 12 tests needed
- components/meetings/ (meeting-form, agenda-editor, participant-badge) — 12 tests
- components/forums/ (reply-composer, thread-card, forum-list) — 12 tests
- components/documents/ (document-card, folder-breadcrumb, upload-dialog) — 12 tests
- components/search/ (search-bar, search-results, search-result-item) — 12 tests
- hooks/ — 20 tests (全部 hooks 的 error/loading states)
- lib/ — 15 tests (utility functions)
- API routes (remaining untested) — 50 tests
```

### Phase 6.2: 用戶指南截圖
**目標：** 100+ 張截圖覆蓋所有功能

```
docs/user-manual.md
  ├── 00-landing (已有多張)
  ├── 01-authentication (新增 OAuth/LDAP/2FA flow) — 8 screenshots
  ├── 02-projects (新增 template/copy/archive) — 10 screenshots
  ├── 03-work-packages (新增 Backlogs/Sprint Planning) — 20 screenshots
  ├── 04-custom-fields (新增所有類型) — 12 screenshots
  ├── 05-wiki (新增 reactions/tags) — 6 screenshots
  ├── 06-forums (新增 voting/accepted answer) — 6 screenshots
  ├── 07-time-tracking (新增 Budgets/EVM) — 8 screenshots
  ├── 08-documents (新增 version diff) — 6 screenshots
  ├── 09-meetings (新增 PDF/ICS export) — 6 screenshots
  ├── 10-notifications (新增 email digest) — 6 screenshots
  ├── 11-repository (新增 GitHub integration) — 8 screenshots
  ├── 12-webhooks (新增 webhook config) — 6 screenshots
  └── 13-admin (新增 roles/custom-fields/system-settings) — 12 screenshots
```

### Phase 6.3: E2E 測試（Playwright）
**目標：** 20 個關鍵 user flows

```
__tests__/e2e/
  ├── auth/login-oauth.test.ts — Google OAuth flow ✅
  ├── auth/login-ldap.test.ts — LDAP login ✅
  ├── auth/2fa.test.ts — TOTP login ✅
  ├── projects/create-from-template.test.ts ✅
  ├── backlogs/sprint-planning.test.ts ✅
  ├── backlogs/burndown.test.ts ✅
  ├── work-packages/custom-fields.test.ts ✅
  ├── work-packages/status-workflow.test.ts ✅
  ├── work-packages/export-pdf.test.ts ✅
  ├── work-packages/watchers.test.ts ✅
  ├── wiki/collab.test.ts — concurrent editing ✅
  ├── forums/voting.test.ts ✅
  ├── time-tracking/approval.test.ts ✅
  ├── budgets/evm.test.ts ✅
  ├── webhooks/delivery.test.ts ✅
  ├── notifications/email-digest.test.ts ✅
  └── admin/rbac.test.ts ✅
```

---

## 📈 測試覆蓋目標

| 類別 | Phase 1-6 完成後目標 |
|------|-------------------|
| Unit tests (lib functions) | 300+ |
| API route tests | 400+ |
| Component tests | 400+ |
| Hook tests | 100+ |
| E2E tests (Playwright) | 20+ |
| **Total** | **1,200+ tests** |

---

## 🗺️ 執行策略：並行 Subagent 調度

由於 Phase 1-6 工作量龐大，建議使用 subagent 並行執行：

```
Agent 1 (Phase 1.1-1.3): Auth 模組 — OAuth/LDAP/2FA
Agent 2 (Phase 1.4-1.6): Account/RBAC — 密碼重置/RBAC/Settings
Agent 3 (Phase 2.1): Backlogs — 最大功能缺口，Sprint Planning
Agent 4 (Phase 2.2-2.3): Custom Fields + Workflow — 核心企業功能
Agent 5 (Phase 2.4-2.6): Export/Watchers/Hierarchy — 導出 + WP 增強
Agent 6 (Phase 3-4): Projects/Integration — 模板/複製/Webhook/Email/Budgets
Agent 7 (Phase 5-6): 增強功能 + 測試覆蓋 + 文檔
```

每個 subagent 配備：
- 獨立工作目錄
- 完整 Phase spec 上下文
- 測試框架配置
- 質量標準（100% test coverage per module）

---

## ⚠️ 關鍵風險

1. **Phase 1.5 RBAC** — 遍歷所有 69 個 API route 需要精確處理，容易漏咗
2. **Phase 2.1 Backlogs** — drag-and-drop 狀態管理複雜，測試難度高
3. **Phase 2.2 Custom Fields** — 影響所有現有 API + UI，需避免破壞現有功能
4. **並行執行** — 多個 subagent 可能修改同一檔案，需要協調
5. **48 週估計** — 係假設每週 40 小時的單人開發，實際可能需要更長

---

## ✅ 質量標準

每個 Phase 完成前必須滿足：

1. `npm test` — 100% tests pass
2. `npm run build` — 編譯成功
3. `npx tsc --noEmit` — 0 TypeScript errors
4. 每個新功能有對應的 test file
5. PR has code review approval
6. docs/user-manual.md 更新了截圖

---

*計劃版本：1.0.0 — 2026-05-10*
*最終更新：[每次Phase完成後更新此文件]*
