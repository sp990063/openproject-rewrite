# OpenProject 100% 功能複製計劃
**目標：** 將 OpenProject 原版所有功能完整移植到 openproject-rewrite  
**最後更新：** 2026-05-10  
**狀態：** 規劃中

---

## 📋 總覽

### 現有實現（Rewrite）| vs | 原版完整功能

| 模組 | Rewrite 狀態 | 原版功能數 | 差異 |
|------|------------|---------|------|
| Authentication | ✅ 基礎登入密碼 | ✅ + LDAP/OAuth/2FA/OpenID | 3個企業認証缺失 |
| Projects | ✅ CRUD/成員/模組 | ✅ + 模板/複製/封存/子項目 | 4個功能缺失 |
| Work Packages | ✅ 四視圖/內聯編輯/關係 | ✅ + Backlogs/自定義字段/狀態工作流 | Backlogs + Custom Fields 缺失 |
| Wiki | ✅ 版本/還原/Markdown | ✅ + 表情/標籤/討論 | 3個功能缺失 |
| Forums | ✅ 討論/回覆 | ✅ + 表情/投票/關注 | 3個功能缺失 |
| Documents | ✅ 資料夾/上傳 | ✅ + 預覽/版本對比 | 版本對比缺失 |
| Meetings | ✅ 議程/參與者 | ✅ + 導出PDF/ICS | 導出缺失 |
| Time Tracking | ✅ 記時/審批 | ✅ + 成本預算/收費率/EVM | 預算/EVM 缺失 |
| Notifications | ✅ 應用內通知 | ✅ + Email摘要/關注(Watchers) | Watchers 缺失 |
| Search | ✅ 基礎搜索 | ✅ + 高級過濾器/保存搜索 | 高級過濾器缺失 |
| My Page | ✅ 3個widget | ✅ + 更多widget/自訂佈局 | widget種類少 |
| Backlogs | ❌ 完全缺失 | ✅ Sprint/Backlog/Story Points | **最大差距** |
| Custom Fields | ❌ 完全缺失 | ✅ 9種類型任意自訂 | **企業核心** |
| RBAC | ⚠️ 簡單角色 | ✅ 細粒度模組/欄位/動作權限 | 差距大 |
| LDAP 集成 | ❌ 完全缺失 | ✅ 用戶/群組同步 | 企業必備 |
| OAuth 2.0 | ❌ 完全缺失 | ✅ Google/GitHub/Azure SSO | 企業必備 |
| 2FA | ❌ 完全缺失 | ✅ TOTP/U2F | 安全必備 |
| Budgets | ❌ 完全缺失 | ✅ 項目/工作包成本 | 企業必備 |
| PDF/CSV 導出 | ❌ 完全缺失 | ✅ 多格式導出定製 | 常用功能 |
| Repository 集成 | ❌ 完全缺失 | ✅ Git/代碼關聯工作包 | DevOps 必備 |
| Webhooks | ⚠️ 基礎 Rate Limit | ✅ 完整 Webhook 系統 | 集成能力差距 |
| 全域設置 | ⚠️ 缺少 | ✅ System Settings/Announcements | 管理功能缺失 |

---

## 第一階段：身份認証與授權（第 1-8 周）

### 1.1 OAuth 2.0 / OpenID Connect SSO
**原版功能：** Google / GitHub / Azure AD / SAML2 單一登入  
**現狀：** 只有 Credentials（用戶名/密碼）

**Task 1.1.1 — Google OAuth**
- [ ] 安裝 `next-auth` OAuth providers
- [ ] 創建 `pages/api/auth/[...nextauth].ts` 新 providers 配置
- [ ] 新增 `providers/google.ts` Google OAuth config
- [ ] 新增 `pages/api/auth/callback/google.ts` callback handler
- [ ] 新增 `hooks/useOAuth.ts` OAuth 登入 state hook
- [ ] 修改 `pages/login.tsx` 添加 "Continue with Google" button
- [ ] 新增 `pages/api/users/[id]/link-oauth.ts` 帳戶綁定 API
- [ ] 新增 `__tests__/oauth/google.test.ts` OAuth 流程測試
- [ ] 新增 `__tests__/oauth/callback.test.ts` callback 處理測試
- [ ] 更新 `docs/user-manual.md` 添加 OAuth 登入截圖（00_landing → 登入頁）
- **檔案變動：** `lib/auth.ts`, `pages/api/auth/[...nextauth].ts`, `pages/login.tsx`, `hooks/useOAuth.ts`, `__tests__/oauth/`
- **測試：** OAuth flow unit tests + E2E login test
- **風險：** NextAuth v5 provider API 有變化；需處理 existing account vs new account 衝突

**Task 1.1.2 — GitHub OAuth**
- [ ] 同上結構，新增 `providers/github.ts`
- [ ] 新增 `pages/api/auth/callback/github.ts`
- [ ] **檔案變動：** `providers/github.ts`, `pages/api/auth/callback/github.ts`
- **測試：** 同 OAuth flow
- **風險：** GitHub OAuth App scope 需要正確配置

**Task 1.1.3 — Azure AD OAuth**
- [ ] 新增 `providers/azure.ts` 使用 `@azure/msal-node` 或直接 OAuth
- [ ] 配置 tenant ID + client ID + client secret
- [ ] **檔案變動：** `providers/azure.ts`, `lib/auth-azure.ts`
- **測試：** Azure AD login E2E test
- **風險：** Azure AD token 解析需要正確的 JWT validation

**Task 1.1.4 — SAML 2.0（可選，企業版）**
- [ ] 安裝 `next-auth` SAML provider 或 `node-saml`
- [ ] 新增 `providers/saml.ts` IdP metadata 配置
- [ ] 新增 `pages/api/auth/saml/[idp]/callback.ts`
- [ ] **檔案變動：** `providers/saml.ts`, `pages/api/auth/saml/`
- **風險：** SAML certificate rotation、XML signature validation 複雜

---

### 1.2 LDAP 認証與群組同步
**原版功能：** LDAP Server 連接、用戶自動創建/同步、群組映射到角色  
**現狀：** 完全缺失

**Task 1.2.1 — LDAP Server 連接層**
- [ ] 安裝 `ldapjs` + `@ldapjs/types`
- [ ] 新增 `lib/ldap/client.ts` — LDAP bind/search connection pool
- [ ] 新增 `lib/ldap/sync.ts` — User import + incremental sync
- [ ] 新增 `lib/ldap/mapper.ts` — LDAP attributes → User fields mapping
- [ ] 新增 `hooks/useLdapSync.ts` — Admin UI 觸發 sync
- [ ] **檔案變動：** `lib/ldap/`, `hooks/useLdapSync.ts`
- **測試：** `__tests__/lib/ldap/` mock LDAP server tests
- **風險：** LDAP connection pooling、SSL cert validation、firewall

**Task 1.2.2 — LDAP 用戶登入**
- [ ] 新增 `pages/api/auth/ldap.ts` — LDAP bind 認證
- [ ] 修改 `lib/auth.ts` 添加 LDAP provider
- [ ] 修改 `pages/login.tsx` 添加 "LDAP" tab (區分於普通登入)
- [ ] 新增 `components/auth/LdapLoginForm.tsx`
- [ ] **檔案變動：** `pages/api/auth/ldap.ts`, `components/auth/LdapLoginForm.tsx`
- **測試：** LDAP auth flow tests
- **風險：** LDAP password 在傳輸中需要 TLS/SSL

**Task 1.2.3 — LDAP 群組 → OpenProject 角色映射**
- [ ] 新增 `lib/ldap/group-map.ts` — LDAP group DN → project role mapping config
- [ ] 新增 `pages/api/ldap/groups.ts` — GET group list from LDAP
- [ ] 新增 `pages/api/ldap/group-mappings.ts` — CRUD group-role mappings
- [ ] 修改 `lib/ldap/sync.ts` 在 sync 時自動應用群組映射
- [ ] 新增 `hooks/useLdapGroupMappings.ts`
- [ ] 新增 `pages/admin/ldap-settings.tsx` — Admin UI for LDAP config
- [ ] **檔案變動：** `lib/ldap/group-map.ts`, `pages/api/ldap/`, `pages/admin/ldap-settings.tsx`, `hooks/useLdapGroupMappings.ts`
- **測試：** Group mapping unit tests
- **風險：** Group mapping config 需要在 user login 時正確應用（race condition）

**Task 1.2.4 — LDAP 自動同步 Cron Job**
- [ ] 新增 `lib/ldap/scheduler.ts` — node-cron 調度
- [ ] 配置 cron job 自動 sync（默認每日凌晨 3 點）
- [ ] 新增 `pages/api/cron/ldap-sync.ts` — 受保护的 cron endpoint
- [ ] **檔案變動：** `lib/ldap/scheduler.ts`, `pages/api/cron/ldap-sync.ts`
- **風險：** Cron job 需要防範重複執行（distributed lock with Redis）

---

### 1.3 雙重驗證（2FA）
**原版功能：** TOTP（Google Authenticator）/ U2F（YubiKey）/ Backup codes  
**現狀：** 完全缺失

**Task 1.3.1 — TOTP 2FA 開啟流程**
- [ ] 安裝 `otplib`（TOTP library）
- [ ] 新增 `lib/2fa/totp.ts` — TOTP secret generation + QR code URI
- [ ] 新增 `lib/2fa/backup-codes.ts` — 生成 10 個 backup codes（bcrypt hashed）
- [ ] 新增 `pages/api/users/[id]/2fa/setup.ts` — POST 生成 secret + QR code
- [ ] 新增 `pages/api/users/[id]/2fa/verify.ts` — POST 驗證首個 TOTP token
- [ ] 新增 `pages/api/users/[id]/2fa/disable.ts` — POST 關閉 2FA（需密碼）
- [ ] 新增 `components/auth/TwoFactorSetupDialog.tsx` — 顯示 QR code + backup codes
- [ ] 修改 `pages/settings/account.tsx` 添加 "Two-factor authentication" section
- [ ] **檔案變動：** `lib/2fa/`, `pages/api/users/[id]/2fa/`, `components/auth/TwoFactorSetupDialog.tsx`
- **測試：** `__tests__/lib/2fa/` TOTP validation tests + Setup flow tests
- **風險：** QR code 包含 secret，需要 HTTPS；backup codes storage 需要 bcrypt

**Task 1.3.2 — TOTP 登入時驗證**
- [ ] 修改 `lib/auth.ts` 在 credentials provider 添加 2FA callback
- [ ] 修改 `pages/login.tsx` 添加第二個 step（輸入 TOTP code）
- [ ] 新增 `components/auth/TwoFactorInput.tsx`
- [ ] 新增 `pages/api/auth/2fa/verify.ts` — 驗證 TOTP token
- [ ] **檔案變動：** `lib/auth.ts`, `pages/login.tsx`, `pages/api/auth/2fa/verify.ts`
- **測試：** 2FA login flow E2E test
- **風險：** 2FA 失敗 lockout 需要 account recovery flow

**Task 1.3.3 — Backup Codes 驗證**
- [ ] 修改 `pages/login.tsx` 添加 backup code 輸入 option
- [ ] 修改 `pages/api/auth/2fa/verify.ts` 支持 backup code
- [ ] 新增 `pages/settings/security.tsx` 查看剩餘 backup codes
- [ ] **檔案變動：** `pages/login.tsx`, `pages/api/auth/2fa/`, `pages/settings/security.tsx`
- **測試：** Backup code flow tests

**Task 1.3.4 — U2F / WebAuthn（YubiKey）**
- [ ] 安裝 `@simplewebauthn/server` + `@simplewebauthn/browser`
- [ ] 新增 `lib/2fa/webauthn.ts` — Registration + Assertion helpers
- [ ] 新增 `pages/api/users/[id]/2fa/webauthn/register.ts` — 設備註冊
- [ ] 新增 `pages/api/users/[id]/2fa/webauthn/assert.ts` — 驗證簽名
- [ ] 修改 `TwoFactorSetupDialog.tsx` 添加 "Register Security Key" tab
- [ ] **檔案變動：** `lib/2fa/webauthn.ts`, `pages/api/users/[id]/2fa/webauthn/`
- **測試：** WebAuthn registration + assertion tests
- **風險：** WebAuthn relying party ID 需要正確配置；瀏覽器兼容性

---

### 1.4 密碼重置 / 邀請郵件
**原版功能：** 忘記密碼郵件 + 重置链接 / 邀請新用戶加入項目郵件  
**現狀：** 完全缺失

**Task 1.4.1 — 忘記密碼流程**
- [ ] 新增 `pages/api/auth/forgot-password.ts` — 發送重置郵件
- [ ] 新增 `pages/api/auth/reset-password.ts` — 驗證 token + 更新密碼
- [ ] 修改 `pages/login.tsx` 添加 "Forgot password?" link
- [ ] 新增 `pages/auth/reset-password.tsx` — 重置密碼 page
- [ ] 新增 `lib/email/password-reset.ts` — Email template + token generation
- [ ] 使用 Redis 存儲 reset token（帶過期時間）
- [ ] **檔案變動：** `pages/api/auth/forgot-password.ts`, `pages/api/auth/reset-password.ts`, `pages/auth/`, `lib/email/`
- **測試：** Password reset flow tests
- **風險：** Token entropy + expiry 需要安全；Email delivery 可能被當垃圾郵件

**Task 1.4.2 — 用戶邀請郵件**
- [ ] 新增 `pages/api/users/invite.ts` — 發送邀請郵件
- [ ] 新增 `pages/api/users/accept-invite.ts` — 接受邀請 + 設置密碼
- [ ] 新增 `pages/admin/users/invite.tsx` — Admin UI 邀請用戶
- [ ] 修改 `pages/projects/[id]/members.tsx` 添加 "Invite member" button
- [ ] 使用 `resend` 發送邀請郵件（已有 resend v4）
- [ ] **檔案變動：** `pages/api/users/invite.ts`, `pages/api/users/accept-invite.ts`, `pages/admin/users/`, `pages/projects/[id]/members.tsx`
- **測試：** Invite flow unit tests
- **風險：** 邀請链接可能過期；一個 email 多個項目邀請的處理

**Task 1.4.3 — 用戶刪除 / 匿名化（GDPR）**
- [ ] 新增 `pages/api/users/[id]/delete.ts` — 軟刪除（set `deletedAt`）
- [ ] 新增 `pages/api/users/[id]/anonymize.ts` — GDPR 匿名化（替換姓名/email）
- [ ] 新增 `pages/admin/users/anonymize-confirm.tsx` — Admin confirm dialog
- [ ] 修改所有查詢在 `include` 中過濾 `deletedAt: null`
- [ ] **檔案變動：** `pages/api/users/[id]/delete.ts`, `pages/api/users/[id]/anonymize.ts`, `prisma/schema.prisma`
- **測試：** User deletion anonymization tests
- **風險：** GDPR 匿名化不可逆；需要 cascade 處理所有 related data

---

### 1.5 細粒度 RBAC 權限系統
**原組功能：** 模組級 / 欄位級 / 動作級權限；內置角色 + 自訂角色  
**現狀：** 只有簡單角色（Admin/Member/Viewer）

**Task 1.5.1 — Prisma Schema 擴展**
- [ ] 新增 `Role` model（id, name, permissions: JSON, builtin: boolean）
- [ ] 新增 `Permission` model（id, action, resource, constraints: JSON）
- [ ] 新增 `ProjectRole` model（userId, projectId, roleId）— 項目級角色
- [ ] 新增 `GlobalRole` model（userId, roleId）— 全局角色
- [ ] 新增 `FieldPermission` model（roleId, resourceType, fieldName, read/write/hidden）
- [ ] 修改 `User` model 添加 `globalRoleId`
- [ ] **檔案變動：** `prisma/schema.prisma`
- **migration:** `prisma migrate dev --name add_rbac`
- **風險：** Migration 需要確保現有用戶數據兼容

**Task 1.5.2 — 內置角色 + 權限 Seed**
- [ ] 新增 `prisma/seed-roles.ts` — seed 內置角色（Non-member, Member, Reader, Project Admin, Admin）
- [ ] 定義權限矩陣：每個角色對每個資源的 CRUD 權限
- [ ] 修改 `prisma/seed.ts` 調用 role seeding
- [ ] **檔案變動：** `prisma/seed-roles.ts`, `prisma/seed.ts`
- **測試：** Role seed unit test
- **風險：** 權限矩陣需要完整覆蓋所有資源；權衡太細緻 vs 實用性

**Task 1.5.3 — 權限檢查核心函數**
- [ ] 新增 `lib/rbac/can.ts` — `can(userId, action, resource, resourceId?)` 核心函數
- [ ] 新增 `lib/rbac/check.ts` — `checkPermission(session, options)` middleware
- [ ] 新增 `lib/rbac/field-filter.ts` — 根據 FieldPermission 過濾 API response fields
- [ ] 新增 `lib/rbac/hooks.ts` — `usePermission(action, resource)` hook
- [ ] **檔案變動：** `lib/rbac/`
- **測試：** `__tests__/lib/rbac/` — 權限矩陣測試（每個角色 × 每個資源 × 每個動作）
- **風險：** 權限檢查每次 DB 查詢；需要 caching（Redis）

**Task 1.5.4 — 應用到所有 API Routes**
- [ ] 遍歷所有 `pages/api/` 路由，添加 `checkPermission` middleware
- [ ] 特別注意：項目級資源（Wiki/Docs/Forums）需要先檢查項目成員資格
- [ ] 添加 `lib/rbac/middleware.ts` — 通用 middleware factory
- [ ] **檔案變動：** 所有 `pages/api/` 路由需要更新
- **測試：** Integration tests 驗證未授權訪問返回 403
- **風險：** 遍歷所有 API 需要小心處理；可能破壞現有功能

**Task 1.5.5 — Admin 角色管理 UI**
- [ ] 新增 `pages/admin/roles/index.tsx` — 角色列表
- [ ] 新增 `pages/admin/roles/[id]/edit.tsx` — 編輯角色權限矩陣 UI
- [ ] 新增 `components/admin/RolePermissionMatrix.tsx` — 可點擊的權限矩陣表
- [ ] 新增 `hooks/useRoles.ts` + `useRoleMutations.ts`（已有 useRoles.ts，需擴展）
- [ ] **檔案變動：** `pages/admin/roles/`, `components/admin/RolePermissionMatrix.tsx`, `hooks/useRoleMutations.ts`
- **測試：** Role management UI tests
- **風險：** 權限矩陣 UI複雜；自訂角色可能與內置角色衝突

**Task 1.5.6 — 項目成員角色管理 UI**
- [ ] 修改 `pages/projects/[id]/members.tsx` — 為每個成員分配角色
- [ ] 新增 `components/projects/MemberRoleSelect.tsx`
- [ ] 修改 `pages/api/projects/[id]/members.ts` 支持角色分配
- [ ] **檔案變動：** `pages/projects/[id]/members.tsx`, `pages/api/projects/[id]/members.ts`

---

## 第二階段：工作包增強（第 9-18 周）

### 2.1 Backlogs（Sprint Planning）— 最大差距
**原版功能：** Product Backlog、Sprint Backlog、Story Points、Burndown Chart、Sprint Planning Board  
**現狀：** 完全缺失

**Task 2.1.1 — Backlog 數據模型**
- [ ] 新增 `Sprint` model（id, projectId, name, startDate, endDate, status, sprintGoal, locked: boolean）
- [ ] 新增 `BacklogItem` model（id, projectId, sprintId nullable, type, subject, storyPoints, priority, order, parentId nullable, children: BacklogItem[]）
- [ ] 修改 `WorkPackage` model 添加 `sprintId`, `storyPoints`, `backlogOrder`
- [ ] 新增 `SprintRelation` model（parentSprintId, childSprintId）— 用於 Sprint 依賴
- [ ] **檔案變動：** `prisma/schema.prisma`
- **migration:** `prisma migrate dev --name add_backlogs`
- **風險：** BacklogItem 和 WorkPackage 的關係需要清晰（一个 BacklogItem 可以对应一个 WorkPackage，或只是一个 backlog 条目）

**Task 2.1.2 — Backlog API Routes**
- [ ] `GET/POST pages/api/backlogs/index.ts` — 項目 Backlogs 列表
- [ ] `GET/PUT/DELETE pages/api/backlogs/[id]/index.ts` — Sprint CRUD
- [ ] `GET/POST pages/api/backlogs/[id]/items.ts` — Backlog items CRUD
- [ ] `PUT pages/api/backlogs/[id]/items/reorder.ts` — 拖曳排序
- [ ] `POST pages/api/backlogs/[id]/items/[itemId]/to-sprint.ts` — 移至 Sprint
- [ ] `POST pages/api/backlogs/[id]/items/[itemId]/to-backlog.ts` — 移至 Backlog
- [ ] `POST pages/api/backlogs/[id]/burndown.ts` — 計算 burndown data
- [ ] **檔案變動：** `pages/api/backlogs/`
- **測試：** `__tests__/api/backlogs.unit.test.ts`
- **風險：** 多人同時拖曳排序需要 optimistic locking

**Task 2.1.3 — Backlog Board UI（主 Sprint Planning 視圖）**
- [ ] 新增 `pages/projects/[id]/backlogs/index.tsx` — Backlog 主頁（Split view：Product Backlog + Sprint Backlog）
- [ ] 新增 `components/backlogs/BacklogBoard.tsx` — 主要 Board component
- [ ] 新增 `components/backlogs/SprintPanel.tsx` — Sprint column（draggable items）
- [ ] 新增 `components/backlogs/ProductBacklogPanel.tsx` — Product Backlog column
- [ ] 新增 `components/backlogs/BacklogItemCard.tsx` — 可拖曳的卡片（顯示 story points、type icon、priority）
- [ ] 新增 `components/backlogs/SprintVelocityCard.tsx` — Sprint velocity 顯示
- [ ] 使用 `@dnd-kit/core` + `@dnd-kit/sortable`（已有）
- [ ] **檔案變動：** `pages/projects/[id]/backlogs/`, `components/backlogs/`
- **測試：** `__tests__/components/backlogs/backlog-board.test.tsx`
- **風險：** 複雜拖放邏輯；虛擬化長列表（可能有 100+ items）

**Task 2.1.4 — Story Points 編輯**
- [ ] 新增 `components/backlogs/StoryPointsEditor.tsx` — 點擊編輯 story points（使用 Fibonacci: 1,2,3,5,8,13,21）
- [ ] 修改 `BacklogItemCard` 添加 story points badge
- [ ] 修改 `WorkPackageTable` 添加 story points column
- [ ] 修改 `pages/api/work-packages/[id]` 支持 storyPoints field
- [ ] **檔案變動：** `components/backlogs/`, `pages/api/work-packages/`
- **測試：** Story points interaction tests

**Task 2.1.5 — Sprint Burndown Chart**
- [ ] 新增 `components/backlogs/BurndownChart.tsx` — 使用 `recharts` 或原生 SVG
- [ ] 計算 Ideal line + Actual line（每日完成的工作量）
- [ ] 新增 `hooks/useBurndown.ts` — 獲取 burndown data
- [ ] **檔案變動：** `components/backlogs/BurndownChart.tsx`, `hooks/useBurndown.ts`
- **測試：** Burndown chart rendering tests
- **風險：** 計算複雜度；需要正確處理沒有時間日誌的 Sprint

**Task 2.1.6 — Sprint Velocity Chart**
- [ ] 新增 `components/backlogs/VelocityChart.tsx` — 歷史 Sprint velocity（柱狀圖）
- [ ] 新增 `hooks/useVelocity.ts`
- [ ] **檔案變動：** `components/backlogs/VelocityChart.tsx`, `hooks/useVelocity.ts`
- **測試：** Velocity chart tests

**Task 2.1.7 — Sprint Planning Dialog**
- [ ] 新增 `components/backlogs/SprintPlanningDialog.tsx` — 創建 Sprint 的 Dialog
- [ ] 包含：Sprint name、start date、end date、Sprint goal
- [ ] 新增 `components/backlogs/SprintGoalEditor.tsx` — inline 編輯 Sprint goal
- [ ] **檔案變動：** `components/backlogs/SprintPlanningDialog.tsx`, `components/backlogs/SprintGoalEditor.tsx`
- **測試：** Sprint creation dialog tests

**Task 2.1.8 — Task/Bug 創建（Backlog 內）**
- [ ] 新增 `components/backlogs/CreateBacklogItemDialog.tsx` — 選擇類型（Story/Task/Bug）+ 輸入 subject
- [ ] BacklogItemCard 上添加 "Add child task" button
- [ ] **檔案變動：** `components/backlogs/CreateBacklogItemDialog.tsx`
- **測試：** Create item dialog tests

**Task 2.1.9 — Sprint 關閉 / 開始**
- [ ] 新增 `pages/api/backlogs/[id]/start.ts` — 開始 Sprint（locked: true，計算 velocity）
- [ ] 新增 `pages/api/backlogs/[id]/close.ts` — 關閉 Sprint（完成剩餘 items 的處理）
- [ ] 修改 Backlog Board UI 添加 "Start Sprint" / "Close Sprint" buttons
- [ ] **檔案變動：** `pages/api/backlogs/[id]/start.ts`, `pages/api/backlogs/[id]/close.ts`
- **測試：** Sprint lifecycle tests
- **風險：** Sprint 關閉後未完成的 items 需要選項（移至下一個 Sprint / 移回 Backlog）

---

### 2.2 Custom Fields（自定義字段）
**原版功能：** 9種自定義字段類型；任意資源附加自訂字段；自訂字段與工作流集成  
**現狀：** 完全缺失

**Task 2.2.1 — Custom Field 數據模型**
- [ ] 新增 `CustomField` model（id, name, type, possibleValues: JSON, regex, required, searchable, displayed, defaultValue, editable, visible）
- [ ] 新增 `CustomFieldProject` model（customFieldId, projectId, editable）— 哪些項目啟用了哪些自訂字段
- [ ] 新增 `CustomFieldValue` model（customFieldId, resourceType, resourceId, value: String）— 實際值存這裡
- [ ] **檔案變動：** `prisma/schema.prisma`
- **migration:** `prisma migrate dev --name add_custom_fields`
- **風險：** CustomFieldValue 的 value 是 string，但不同類型需要不同 validation

**Task 2.2.2 — Custom Field Types 定義**
- [ ] 新增 `lib/custom-fields/types.ts` — 定義 9 種類型：
  - `STRING` — 單行文字
  - `TEXT` — 多行文字
  - `INTEGER` — 整數
  - `FLOAT` — 浮點數
  - `BOOLEAN` — 勾選框
  - `DATE` — 日期
  - `DATE_TIME` — 日期時間
  - `LIST` — 單選列表
  - `MULTI_LIST` — 多選列表
  - `USER` — 用戶選擇
  - `VERSION` — 版本選擇
  - `PRIORITY` — 優先級選擇
- [ ] 每種類型有對應的 Zod schema + input component + display component
- [ ] **檔案變動：** `lib/custom-fields/types.ts`, `lib/custom-fields/validation.ts`
- **測試：** Custom field type validation tests

**Task 2.2.3 — Custom Field API Routes**
- [ ] `GET/POST pages/api/custom-fields/index.ts` — 列表 + 創建
- [ ] `GET/PUT/DELETE pages/api/custom-fields/[id]/index.ts` — CRUD
- [ ] `PUT pages/api/custom-fields/[id]/projects.ts` — 分配到項目
- [ ] `GET pages/api/custom-fields/for-resource.ts?resourceType=work_package&projectId=x` — 獲取某資源在某項目可用的 custom fields
- [ ] **檔案變動：** `pages/api/custom-fields/`
- **測試：** `__tests__/api/custom-fields.unit.test.ts`

**Task 2.2.4 — Custom Field 值 API（附加到資源）**
- [ ] 新增 `pages/api/custom-field-values/index.ts` — 批量設置 custom field values
- [ ] 修改 `pages/api/work-packages/[id]/index.ts` 在 GET/PUT 時 include custom field values
- [ ] 同樣處理：Wiki、Forums、Meetings、Projects 等資源
- [ ] **檔案變動：** `pages/api/custom-field-values/index.ts`, `pages/api/work-packages/[id]/index.ts`
- **測試：** Custom field values integration tests
- **風險：** 每個資源都要修改，工作量大

**Task 2.2.5 — Custom Field Input Components**
- [ ] 新增 `components/custom-fields/StringField.tsx`
- [ ] 新增 `components/custom-fields/TextField.tsx`
- [ ] 新增 `components/custom-fields/IntegerField.tsx`
- [ ] 新增 `components/custom-fields/FloatField.tsx`
- [ ] 新增 `components/custom-fields/BooleanField.tsx`
- [ ] 新增 `components/custom-fields/DateField.tsx`
- [ ] 新增 `components/custom-fields/DateTimeField.tsx`
- [ ] 新增 `components/custom-fields/ListField.tsx`
- [ ] 新增 `components/custom-fields/MultiListField.tsx`
- [ ] 新增 `components/custom-fields/UserField.tsx`
- [ ] 新增 `components/custom-fields/VersionField.tsx`
- [ ] 新增 `components/custom-fields/CustomFieldRenderer.tsx` — 根據類型 render 對應 component
- [ ] **檔案變動：** `components/custom-fields/`
- **測試：** `__tests__/components/custom-fields/`
- **風險：** UI 需要與現有表單整合

**Task 2.2.6 — 工作包表單集成 Custom Fields**
- [ ] 修改 `WorkPackageTable` 添加自訂字段 columns
- [ ] 修改 `components/work-packages/detail/AttributeSidebar.tsx` 添加自訂字段 section
- [ ] 修改 `components/work-packages/table/WorkPackageInlineEdit.tsx` 支持 inline 編輯自訂字段
- [ ] **檔案變動：** `components/work-packages/detail/AttributeSidebar.tsx`, `components/work-packages/table/`
- **測試：** Work package custom fields integration tests
- **風險：** 自訂字段在 table view 的 column 管理複雜

**Task 2.2.7 — Custom Field 管理 UI**
- [ ] 新增 `pages/admin/custom-fields/index.tsx` — Custom Fields 列表
- [ ] 新增 `pages/admin/custom-fields/new.tsx` — 創建 custom field（type selector + 選項配置）
- [ ] 新增 `pages/admin/custom-fields/[id]/edit.tsx` — 編輯 custom field
- [ ] 新增 `components/admin/CustomFieldForm.tsx` — 通用表單 component
- [ ] **檔案變動：** `pages/admin/custom-fields/`, `components/admin/CustomFieldForm.tsx`
- **測試：** Custom field CRUD UI tests

**Task 2.2.8 — 自訂字段搜索引擎優化**
- [ ] 修改 `lib/search.ts` 支持 custom field values 搜索
- [ ] 修改 `pages/api/search.ts` 在 filter 中支持 custom field conditions
- [ ] **檔案變動：** `lib/search.ts`, `pages/api/search.ts`
- **測試：** Custom field search tests
- **風險：** Custom field value 搜索可能好慢（需要 full-text index）

---

### 2.3 工作包狀態工作流
**原版功能：** 狀態轉移規則（某狀態只可轉移到特定狀態）；內置狀態 + 自訂狀態  
**現狀：** 只有簡單狀態（無轉移規則）

**Task 2.3.1 — Status Workflow 數據模型**
- [ ] 新增 `StatusWorkflow` model（id, typeId, statusId, fromStatuses: JSON, toStatuses: JSON, roleId nullable）
- [ ] 新增 `Type` model（id, name, isMilestone, attributeGroups: JSON）
- [ ] 擴展 `Status` model 添加 `position`, `isDefault`, `isClosed`
- [ ] **檔案變動：** `prisma/schema.prisma`
- **migration:** `prisma migrate dev --name add_status_workflows`

**Task 2.3.2 — Status Workflow API**
- [ ] `GET/POST pages/api/statuses/workflows.ts` — 狀態工作流 CRUD
- [ ] `GET pages/api/types/index.ts` — 類型列表
- [ ] `POST pages/api/types/index.ts` — 創建類型
- [ ] 修改 `pages/api/statuses/index.ts` 支持 position reorder
- [ ] **檔案變動：** `pages/api/statuses/`, `pages/api/types/`
- **測試：** `__tests__/api/statuses.unit.test.ts`

**Task 2.3.3 — 工作流視圖 UI（Admin）**
- [ ] 新增 `pages/admin/workflows/index.tsx` — 工作流配置矩陣
- [ ] 新增 `components/admin/WorkflowMatrix.tsx` — 可視化狀態轉移矩陣
- [ ] **檔案變動：** `pages/admin/workflows/`, `components/admin/WorkflowMatrix.tsx`
- **測試：** Workflow UI tests

**Task 2.3.4 — 工作包狀態轉移約束**
- [ ] 修改 `pages/api/work-packages/[id]/index.ts` — 在狀態更新時檢查工作流規則
- [ ] 新增 `lib/workflows/can-transition.ts` — 檢查是否可以轉移
- [ ] 修改 `WorkPackageTableRow` / `AttributeSidebar` — 只顯示允許的下一狀態
- [ ] **檔案變動：** `lib/workflows/`, `pages/api/work-packages/[id]/index.ts`
- **測試：** Workflow transition tests

---

### 2.4 工作包導出（PDF / CSV）
**原版功能：** PDF 導出（自訂模板）、CSV 導出、Atom Feed  
**現狀：** 完全缺失

**Task 2.4.1 — CSV 導出**
- [ ] 新增 `lib/export/csv.ts` — Work Package → CSV converter
- [ ] 新增 `pages/api/work-packages/export/csv.ts` — 返回 CSV file stream
- [ ] 修改 `WorkPackageTable` 添加 "Export" dropdown（CSV + PDF）
- [ ] **檔案變動：** `lib/export/csv.ts`, `pages/api/work-packages/export/csv.ts`, `components/work-packages/table/WorkPackageTable.tsx`
- **測試：** CSV export tests
- **風險：** 大數據量（1000+ rows）需要 streaming

**Task 2.4.2 — PDF 導出**
- [ ] 安裝 `@react-pdf/renderer` 或 `puppeteer`（推薦 `@react-pdf/renderer` server-side）
- [ ] 新增 `lib/export/pdf.ts` — Work Package list → PDF document
- [ ] 新增 `components/export/templates/WorkPackageListPdf.tsx` — PDF template
- [ ] 新增 `pages/api/work-packages/export/pdf.ts`
- [ ] **檔案變動：** `lib/export/pdf.ts`, `pages/api/work-packages/export/pdf.ts`
- **測試：** PDF export rendering tests
- **風險：** PDF 樣式複雜；中文支援需要 font embedding

**Task 2.4.3 — Atom Feed**
- [ ] 新增 `pages/api/work-packages/feed.ts` — 返回 Atom XML
- [ ] 修改 `pages/projects/[id]/work-packages/index.tsx` 添加 Atom link
- [ ] **檔案變動：** `pages/api/work-packages/feed.ts`
- **測試：** Atom feed tests

---

### 2.5 工作包 Watchers（關注者）
**原版功能：** 多人關注同一工作包，自動收到通知  
**現狀：** 完全缺失

**Task 2.5.1 — Watcher 數據模型**
- [ ] 新增 `Watcher` model（userId, resourceType, resourceId）
- [ ] 修改 `Notification` model — 添加 `watcherId` 關聯
- [ ] **檔案變動：** `prisma/schema.prisma`
- **migration:** `prisma migrate dev --name add_watchers`

**Task 2.5.2 — Watcher API**
- [ ] `GET pages/api/work-packages/[id]/watchers.ts` — 列表 watchers
- [ ] `POST pages/api/work-packages/[id]/watchers.ts` — 添加 watcher
- [ ] `DELETE pages/api/work-packages/[id]/watchers/[userId].ts` — 移除 watcher
- [ ] 同樣應用到 Wiki、Forums、Documents、Meetings
- [ ] **檔案變動：** `pages/api/work-packages/[id]/watchers.ts`, 等
- **測試：** Watcher API tests

**Task 2.5.3 — Watcher UI**
- [ ] 修改 `components/work-packages/detail/AttributeSidebar.tsx` 添加 "Watching" toggle
- [ ] 新增 `components/work-packages/WatcherList.tsx` — 顯示所有 watchers（頭像列表）
- [ ] **檔案變動：** `components/work-packages/detail/AttributeSidebar.tsx`, `components/work-packages/WatcherList.tsx`
- **測試：** Watcher UI tests

---

### 2.6 工作包父子關係增強
**原版功能：** 「是否決定性子項（Decidable Children）」— 影響排程計算  
**現狀：** 簡單 parent/child，無排程邏輯

**Task 2.6.1 — 父子關係類型**
- [ ] 擴展 `WorkPackage` model 添加 `parentId` 和 `relationType`（`normal` | `hierarchy` | `summarizes`）
- [ ] 新增 `lib/work-packages/scheduling-engine.ts` — 計算父子排程（考慮決定性子項）
- [ ] **檔案變動：** `prisma/schema.prisma`, `lib/work-packages/scheduling-engine.ts`
- **測試：** Scheduling engine unit tests

**Task 2.6.2 — 父子視圖 UI**
- [ ] 修改 `WorkPackageTable` 添加 hierarchy view（折疊/展開樹狀結構）
- [ ] 新增 `components/work-packages/HierarchyTree.tsx`
- [ ] **檔案變動：** `components/work-packages/HierarchyTree.tsx`
- **測試：** Hierarchy view tests

---

## 第三階段：項目管理增強（第 19-26 周）

### 3.1 項目模板
**原版功能：** 以現有項目為模板創建新項目；複製項目結構  
**現狀：** 完全缺失

**Task 3.1.1 — 項目模板數據模型**
- [ ] 修改 `Project` model 添加 `isTemplate: boolean`, `templateSourceId: string nullable`
- [ ] **檔案變動：** `prisma/schema.prisma`
- **migration:** `prisma migrate dev --name add_project_templates`

**Task 3.1.2 — 項目模板 API**
- [ ] `GET pages/api/projects/templates.ts` — 列表模板項目
- [ ] `POST pages/api/projects/from-template.ts` — 從模板創建項目（deep copy 所有資源）
- [ ] **檔案變動：** `pages/api/projects/templates.ts`, `pages/api/projects/from-template.ts`
- **測試：** Project template tests
- **風險：** Deep copy 涉及大量資源，需要 transaction；用户/群組需要重新映射

**Task 3.1.3 — 模板創建 / 應用 UI**
- [ ] 修改 `pages/projects/index.tsx` 添加 "Create from template" option
- [ ] 新增 `components/projects/TemplateSelector.tsx` — 選擇模板 dialog
- [ ] **檔案變動：** `pages/projects/index.tsx`, `components/projects/TemplateSelector.tsx`
- **測試：** Template selector tests

---

### 3.2 項目複製
**原版功能：** 完整複製項目（所有工作包、Wiki、Forums 等）  
**現狀：** 完全缺失

**Task 3.2.1 — 項目複製 API**
- [ ] 新增 `pages/api/projects/[id]/copy.ts` — 深複製整個項目
- [ ] 遍歷所有模組：work_packages, wiki_pages, forums, documents, meetings, members, queries
- [ ] 所有 ID 需要重新生成，引用需要正確更新
- [ ] **檔案變動：** `pages/api/projects/[id]/copy.ts`
- **測試：** Project copy tests
- **風險：** 大量數據的 transaction 處理；複製期間項目鎖定

**Task 3.2.2 — 項目複製 UI**
- [ ] 修改 `pages/projects/[id]/settings.tsx` 添加 "Copy project" button
- [ ] 新增 `components/projects/ProjectCopyDialog.tsx` — 選擇要複製的模組
- [ ] **檔案變動：** `components/projects/ProjectCopyDialog.tsx`
- **測試：** Project copy dialog tests

---

### 3.3 項目封存
**原版功能：** 封存 / 恢復項目；封存後項目不在常規列表顯示  
**現狀：** 完全缺失

**Task 3.3.1 — 封存功能**
- [ ] 修改 `Project` model 添加 `archivedAt: DateTime nullable`
- [ ] 修改 `pages/api/projects/index.ts` — 列表時過濾 `archivedAt: null`（除非 `includeArchived=true`）
- [ ] 新增 `pages/api/projects/[id]/archive.ts` — 封存
- [ ] 新增 `pages/api/projects/[id]/unarchive.ts` — 恢復
- [ ] 修改 `pages/projects/index.tsx` 添加 "Archived" toggle
- [ ] **檔案變動：** `prisma/schema.prisma`, `pages/api/projects/`, `pages/projects/index.tsx`
- **測試：** Archive/unarchive tests

---

### 3.4 項目版本管理（Roadmap）
**原版功能：** 版本列表 + 預計發布日期 + 關聯工作包  
**現狀：** 完全缺失

**Task 3.4.1 — 版本數據模型**
- [ ] 新增 `Version` model（id, projectId, name, description, status, startDate, endDate, wikiPageId nullable）
- [ ] 新增 `VersionWorkPackage` model（versionId, workPackageId）— 多對多
- [ ] **檔案變動：** `prisma/schema.prisma`
- **migration:** `prisma migrate dev --name add_versions`

**Task 3.4.2 — 版本 API**
- [ ] `GET/POST pages/api/projects/[id]/versions/index.ts`
- [ ] `GET/PUT/DELETE pages/api/projects/[id]/versions/[versionId]/index.ts`
- [ ] `GET/POST pages/api/projects/[id]/versions/[versionId]/work-packages.ts` — 關聯工作包
- [ ] **檔案變動：** `pages/api/projects/[id]/versions/`
- **測試：** Version API tests

**Task 3.4.3 — Roadmap UI**
- [ ] 新增 `pages/projects/[id]/roadmap.tsx` — Roadmap 主頁
- [ ] 新增 `components/roadmap/RoadmapTimeline.tsx` — 時間軸視圖
- [ ] 新增 `components/roadmap/VersionCard.tsx` — 版本卡片（顯示 status + 工作包 count）
- [ ] 新增 `hooks/useVersions.ts`
- [ ] **檔案變動：** `pages/projects/[id]/roadmap.tsx`, `components/roadmap/`
- **測試：** Roadmap UI tests

---

### 3.5 新聞模組（News）
**原版功能：** 項目新聞 / 公告列表  
**現狀：** 完全缺失

**Task 3.5.1 — 新聞數據模型**
- [ ] 新增 `News` model（id, projectId, authorId, title, summary, content, slug, createdAt, updatedAt）
- [ ] **檔案變動：** `prisma/schema.prisma`
- **migration:** `prisma migrate dev --name add_news`

**Task 3.5.2 — 新聞 API**
- [ ] `GET/POST pages/api/projects/[id]/news/index.ts`
- [ ] `GET/PUT/DELETE pages/api/projects/[id]/news/[newsId]/index.ts`
- [ ] **檔案變動：** `pages/api/projects/[id]/news/`
- **測試：** News API tests

**Task 3.5.3 — 新聞 UI**
- [ ] 新增 `pages/projects/[id]/news/index.tsx` — 新聞列表
- [ ] 新增 `pages/projects/[id]/news/[id]/index.tsx` — 新聞詳情
- [ ] 新增 `components/news/NewsCard.tsx`
- [ ] 修改 `Sidebar` 添加 News link
- [ ] **檔案變動：** `pages/projects/[id]/news/`, `components/news/`, `components/layout/Sidebar.tsx`
- **測試：** News UI tests

---

### 3.6 項目子項目
**原版功能：** 項目可以有子項目（層次結構）  
**現狀：** 項目是扁平的

**Task 3.6.1 — 子項目支持**
- [ ] 修改 `Project` model 添加 `parentId: string nullable`
- [ ] 修改 `pages/api/projects/index.ts` — 支持嵌套列表
- [ ] 修改 `Sidebar` — 支持多層項目樹
- [ ] **檔案變動：** `prisma/schema.prisma`, `pages/api/projects/`, `components/layout/Sidebar.tsx`
- **測試：** Subproject tests

---

## 第四階段：集成與導出（第 27-34 周）

### 4.1 Repository 集成
**原版功能：** 顯示 Git 提交與工作包的關聯；commit message 自動關聯工作包  
**現狀：** 完全缺失

**Task 4.1.1 — Repository 數據模型**
- [ ] 新增 `Repository` model（id, projectId, type: enum, url, repositoryPath, branch）
- [ ] 新增 `Commit` model（id, repositoryId, sha, message, authorName, authorEmail, committedAt, linkedWorkPackages: String[]）
- [ ] **檔案變動：** `prisma/schema.prisma`
- **migration:** `prisma migrate dev --name add_repositories`

**Task 4.1.2 — Repository API**
- [ ] `GET/POST pages/api/projects/[id]/repositories/index.ts`
- [ ] `GET pages/api/repositories/[id]/commits.ts`
- [ ] `POST pages/api/repositories/webhook.ts` — 接收 GitHub/GitLab webhook
- [ ] **檔案變動：** `pages/api/projects/[id]/repositories/`, `pages/api/repositories/webhook.ts`
- **測試：** Repository webhook tests

**Task 4.1.3 — Commit 關聯工作包**
- [ ] 新增 `lib/repositories/commit-linker.ts` — 解析 commit message 中的 `#123` 格式，自動關聯工作包
- [ ] **檔案變動：** `lib/repositories/commit-linker.ts`
- **測試：** Commit linker regex tests

**Task 4.1.4 — Repository UI**
- [ ] 新增 `pages/projects/[id]/repository/index.tsx` — Repository 主頁（commit list）
- [ ] 新增 `components/repository/CommitList.tsx`
- [ ] 修改 `components/work-packages/detail/RelationsList.tsx` 添加 "Commits" section
- [ ] **檔案變動：** `pages/projects/[id]/repository/`, `components/repository/`
- **測試：** Repository UI tests

---

### 4.2 GitHub / Jenkins 集成
**原版功能：** GitHub PR 狀態顯示在 Work Package；Jenkins CI 狀態顯示  
**現狀：** 完全缺失

**Task 4.2.1 — GitHub Integration**
- [ ] 新增 `pages/api/integrations/github/webhook.ts` — 接收 GitHub webhook
- [ ] 新增 `pages/api/integrations/github/status.ts` — 發送 commit status 到 GitHub
- [ ] 新增 `components/integrations/GithubStatusBadge.tsx` — 顯示在 Work Package 上
- [ ] **檔案變動：** `pages/api/integrations/github/`, `components/integrations/GithubStatusBadge.tsx`
- **測試：** GitHub webhook tests

**Task 4.2.2 — Jenkins Integration**
- [ ] 新增 `pages/api/integrations/jenkins/webhook.ts`
- [ ] 新增 `pages/api/integrations/jenkins/build-status.ts`
- [ ] 新增 `components/integrations/JenkinsStatusBadge.tsx`
- [ ] **檔案變動：** `pages/api/integrations/jenkins/`, `components/integrations/JenkinsStatusBadge.tsx`
- **測試：** Jenkins webhook tests

---

### 4.3 Webhook 系統
**原版功能：** 自訂 Webhook — 事件觸發 HTTP POST 到外部系統  
**現狀：** 只有 Rate Limiting

**Task 4.3.1 — Webhook 數據模型**
- [ ] 新增 `Webhook` model（id, projectId, url, secret, events: String[], enabled: boolean）
- [ ] 新增 `WebhookDelivery` model（id, webhookId, event, payload: JSON, responseCode, deliveredAt）
- [ ] **檔案變動：** `prisma/schema.prisma`
- **migration:** `prisma migrate dev --name add_webhooks`

**Task 4.3.2 — Webhook Core**
- [ ] 新增 `lib/webhooks/dispatcher.ts` — `dispatchEvent(event, resource, payload)` 發送 webhook
- [ ] 在所有資源的 mutation hooks 中調用 `dispatcher`（WorkPackage created/updated, Wiki saved, etc.）
- [ ] 新增 `lib/webhooks/delivery.ts` — HTTP POST + retry logic（exponential backoff）
- [ ] **檔案變動：** `lib/webhooks/`
- **測試：** Webhook dispatcher unit tests

**Task 4.3.3 — Webhook API**
- [ ] `GET/POST pages/api/projects/[id]/webhooks/index.ts`
- [ ] `GET/PUT/DELETE pages/api/projects/[id]/webhooks/[webhookId]/index.ts`
- [ ] `GET pages/api/projects/[id]/webhooks/[webhookId]/deliveries.ts`
- [ ] `POST pages/api/projects/[id]/webhooks/[webhookId]/test.ts` — 發送測試 webhook
- [ ] **檔案變動：** `pages/api/projects/[id]/webhooks/`
- **測試：** Webhook API tests

**Task 4.3.4 — Webhook UI**
- [ ] 新增 `pages/projects/[id]/settings/integrations.tsx` — Webhook 管理
- [ ] 新增 `components/projects/WebhookForm.tsx`
- [ ] 新增 `components/projects/WebhookDeliveryLog.tsx`
- [ ] **檔案變動：** `pages/projects/[id]/settings/integrations.tsx`, `components/projects/WebhookForm.tsx`
- **測試：** Webhook UI tests

---

### 4.4 PDF 導出定製（項目級）
**原版功能：** 自訂 PDF 模板（Logo、公司名、頁眉頁腳）  
**現狀：** 只有基礎 PDF

**Task 4.4.1 — PDF 模板配置**
- [ ] 修改 `Project` model 添加 `pdfLogo: string nullable, pdfFooter: string nullable`
- [ ] 新增 `pages/api/projects/[id]/pdf-settings.ts` — 上傳 logo + 配置 footer
- [ ] **檔案變動：** `prisma/schema.prisma`, `pages/api/projects/[id]/pdf-settings.ts`

**Task 4.4.2 — 項目 PDF 導出**
- [ ] 修改 `lib/export/pdf.ts` 讀取項目的 PDF 配置
- [ ] 修改 `pages/projects/[id]/documents/[docId]/index.tsx` 添加 "Download PDF" button
- [ ] **檔案變動：** `lib/export/pdf.ts`
- **測試：** Custom PDF template tests

---

### 4.5 Email 通知增強
**原版功能：** 即時 Email 通知 + 日報摘要（Daily Digest）  
**現狀：** 只有 In-app 通知；Resend 已裝但未完整集成

**Task 4.5.1 — Email 即時通知**
- [ ] 修改 `pages/api/notifications/send.ts` — 觸發 Email 發送（已有 Resend）
- [ ] 新增 `lib/email/notification-email.ts` — Email template for each notification type
- [ ] 新增 `lib/email/templates/` — HTML email templates（使用 `react-email` 或 `mjml`）
- [ ] 修改 User 有 `emailNotifications: 'instant' | 'daily' | 'only-own' | 'none'`
- [ ] **檔案變動：** `lib/email/notification-email.ts`, `lib/email/templates/`, `prisma/schema.prisma`
- **測試：** Email notification tests
- **風險：** Email delivery rate limit；SPF/DKIM/DMARC 需要正確配置

**Task 4.5.2 — Email 日報摘要（Daily Digest）**
- [ ] 新增 `lib/email/digest.ts` — 生成每日摘要內容
- [ ] 新增 cron job `pages/api/cron/daily-digest.ts` — 每日早上 8 點（按用戶時區）發送
- [ ] 修改 User model 添加 `digestFrequency: 'daily' | 'weekly' | 'none'`
- [ ] **檔案變動：** `lib/email/digest.ts`, `pages/api/cron/daily-digest.ts`
- **測試：** Digest generation tests
- **風險：** 時區處理；大量用戶的 batch 發送

**Task 4.5.3 — Email 通知偏好設置**
- [ ] 修改 `pages/settings/notifications.tsx` — 添加 Email 頻率選擇
- [ ] 修改 `hooks/useNotificationSettings.ts` 支持 email 偏好
- [ ] **檔案變動：** `pages/settings/notifications.tsx`, `hooks/useNotificationSettings.ts`
- **測試：** Notification preferences tests

---

### 4.6 Budgets / 成本管理
**原版功能：** 項目預算、每工作包成本、按類型 / 項目報告  
**現狀：** 只有時間記錄

**Task 4.6.1 — Budget 數據模型**
- [ ] 新增 `Budget` model（id, projectId, subject, description, amount, currency）
- [ ] 修改 `WorkPackage` model 添加 `estimatedHours`, `actualHours`, `laborCost`, `materialCost`
- [ ] 新增 `CostEntry` model（id, workPackageId, userId, type: 'labor'|'material'|'fuel', units, unitCost, createdAt）
- [ ] **檔案變動：** `prisma/schema.prisma`
- **migration:** `prisma migrate dev --name add_budgets`

**Task 4.6.2 — Budget API + UI**
- [ ] `pages/api/projects/[id]/budgets/` — CRUD
- [ ] `pages/api/cost-entries/` — CRUD
- [ ] `pages/projects/[id]/budgets/index.tsx` — Budget 管理頁
- [ ] `components/budgets/BudgetOverview.tsx` — 圖表
- [ ] **檔案變動：** `pages/api/projects/[id]/budgets/`, `pages/projects/[id]/budgets/`, `components/budgets/`
- **測試：** Budget CRUD tests

**Task 4.6.3 — EVM 指標（掊工成本管理）**
- [ ] 新增 `lib/budgets/evm.ts` — 計算 PV/EV/AC/SPI/CPI
- [ ] 新增 `components/budgets/EvmChart.tsx` — SPI/CPI 趨勢圖
- [ ] **檔案變動：** `lib/budgets/evm.ts`, `components/budgets/EvmChart.tsx`
- **測試：** EVM calculation tests

---

## 第五階段：其他功能（第 35-42 周）

### 5.1 全域系統設置
**原版功能：** System Settings、Announcements、Logo 配置  
**現狀：** 缺失

**Task 5.1.1 — System Settings**
- [ ] 新增 `SystemSetting` model（key, value: JSON）
- [ ] 新增 `pages/api/admin/settings/index.ts` — CRUD
- [ ] 新增 `pages/admin/settings/index.tsx` — Admin 設置頁
- [ ] **檔案變動：** `prisma/schema.prisma`, `pages/api/admin/settings/`, `pages/admin/settings/index.tsx`
- **測試：** System settings tests

**Task 5.1.2 — Announcements**
- [ ] 新增 `Announcement` model（id, content, expiresAt, createdAt）
- [ ] 新增 `pages/api/announcements/index.ts`
- [ ] 修改 `AuthenticatedLayout` — 顯示 announcement banner
- [ ] **檔案變動：** `prisma/schema.prisma`, `pages/api/announcements/`, `components/layout/AuthenticatedLayout.tsx`
- **測試：** Announcement tests

**Task 5.1.3 — 全域廣播**
- [ ] 使用 SSE 全域廣播 announcement 到所有在線用户
- [ ] **檔案變動：** `pages/api/sse/index.ts` — 添加 `announcement` channel
- **測試：** SSE announcement tests

---

### 5.2 Wiki 增強
**原版功能：** 表情反應、標籤、討論線程  
**現狀：** 只有基本功能

**Task 5.2.1 — Wiki 表情反應**
- [ ] 新增 `WikiReaction` model（wikiPageId, userId, emoji）
- [ ] 新增 `pages/api/wiki/[id]/reactions.ts`
- [ ] 修改 `components/wiki/WikiPageView.tsx` 添加 reactions bar
- [ ] **檔案變動：** `prisma/schema.prisma`, `pages/api/wiki/[id]/reactions.ts`
- **測試：** Wiki reaction tests

**Task 5.2.2 — Wiki 標籤**
- [ ] 新增 `Tag` model（name, color）+ `WikiPageTag` model（wikiPageId, tagId）
- [ ] 新增 `pages/api/wiki/tags/index.ts`
- [ ] 修改 Wiki 編輯器添加 tag input
- [ ] **檔案變動：** `prisma/schema.prisma`, `pages/api/wiki/tags/`, `components/wiki/WikiEditor.tsx`
- **測試：** Wiki tags tests

---

### 5.3 Forum 增強
**原版功能：** 表情回覆、投票、標記最佳答案  
**現狀：** 只有基本功能

**Task 5.3.1 — Forum 表情**
- [ ] 新增 `ForumReaction` model
- [ ] 修改 `components/forums/ForumMessageCard.tsx` 添加 reactions
- [ ] **檔案變動：** `prisma/schema.prisma`, `components/forums/ForumMessageCard.tsx`

**Task 5.3.2 — Forum 投票**
- [ ] 新增 `ForumVote` model（threadId, userId, value: 1/-1）
- [ ] 新增 `pages/api/forums/[id]/threads/[threadId]/vote.ts`
- [ ] 修改 `ThreadCard` 顯示 vote count
- [ ] **檔案變動：** `prisma/schema.prisma`, `pages/api/forums/[id]/threads/[threadId]/vote.ts`
- **測試：** Forum vote tests

**Task 5.3.3 — 最佳答案**
- [ ] 新增 `Post.isAccepted: boolean`
- [ ] 新增 `pages/api/forums/[id]/threads/[threadId]/posts/[postId]/accept.ts`
- [ ] 修改 UI 標記最佳答案
- [ ] **檔案變動：** `prisma/schema.prisma`, `pages/api/forums/[id]/threads/[threadId]/posts/[postId]/accept.ts`
- **測試：** Accept answer tests

---

### 5.4 文檔版本對比
**原版功能：** 文檔歷史版本 diff view  
**現狀：** 只有版本列表

**Task 5.4.1 — 文檔版本對比**
- [ ] 新增 `pages/api/documents/[id]/versions/[v1]/diff/[v2].ts` — 計算兩個版本的 diff
- [ ] 新增 `components/documents/VersionDiffViewer.tsx` — 並排 diff view
- [ ] **檔案變動：** `pages/api/documents/[id]/versions/[v1]/diff/[v2].ts`, `components/documents/VersionDiffViewer.tsx`
- **測試：** Document diff tests
- **風險：** Binary 文件（PDF/圖片）不能 text diff，需要特殊處理

---

### 5.5 高級搜索保存
**原版功能：** 搜索條件保存、搜索訂閱  
**現狀：** 只有即時搜索

**Task 5.5.1 — 保存搜索**
- [ ] 新增 `SavedSearch` model（userId, projectId nullable, name, queryParams: JSON）
- [ ] 新增 `pages/api/searches/index.ts`
- [ ] 修改 `components/search/SearchBar.tsx` 添加 "Save search" button
- [ ] **檔案變動：** `prisma/schema.prisma`, `pages/api/searches/`, `components/search/SearchBar.tsx`
- **測試：** Saved search tests

**Task 5.5.2 — 搜索訂閱（Alert）**
- [ ] 新增 `SearchAlert` model（savedSearchId, frequency: 'daily'|'weekly'）
- [ ] 新增 cron job 定期運行保存的搜索，發現新結果時發送通知
- [ ] **檔案變動：** `prisma/schema.prisma`, `pages/api/cron/search-alerts.ts`
- **測試：** Search alert tests

---

### 5.6 My Page Widget 擴展
**原版功能：** 更多 widget 類型、自訂佈局（拖放）  
**現狀：** 只有 3 個 widget

**Task 5.6.1 — Widget 類型擴展**
- [ ] 新增 `components/my-page/widgets/WorkPackageListWidget.tsx` — 自訂列表 widget
- [ ] 新增 `components/my-page/widgets/DocumentsWidget.tsx` — 最近文檔
- [ ] 新增 `components/my-page/widgets/WikiChangesetsWidget.tsx` — Wiki 最近的更改
- [ ] 新增 `components/my-page/widgets/BudgetWidget.tsx` — 預算概覽
- [ ] **檔案變動：** `components/my-page/widgets/`
- **測試：** New widget tests

**Task 5.6.2 — 拖放佈局**
- [ ] 使用 `@dnd-kit/sortable` 實現 My Page widget 拖放重排
- [ ] 修改 `pages/my-page.tsx` 為 `react-grid-layout` 或 `@dnd-kit`
- [ ] 保存佈局到 `User` model 或專門的 `MyPageLayout` model
- [ ] **檔案變動：** `pages/my-page.tsx`, `components/my-page/`
- **測試：** My page layout tests

---

### 5.7 Meeting Minutes PDF/ICS 導出
**原版功能：** 會議紀錄導出 PDF、ICS 日曆邀請  
**現狀：** 只有基礎顯示

**Task 5.7.1 — ICS 日曆導出**
- [ ] 新增 `lib/meetings/ics.ts` — 生成 ICS 格式
- [ ] 修改 `pages/api/meetings/[id]/index.ts` 返回 ICS format（`Accept: text/calendar`）
- [ ] 修改 Meeting detail UI 添加 "Add to Calendar" button
- [ ] **檔案變動：** `lib/meetings/ics.ts`, `pages/api/meetings/[id]/index.ts`
- **測試：** ICS generation tests

**Task 5.7.2 — Meeting Minutes PDF**
- [ ] 新增 `lib/meetings/pdf.ts` — 生成 PDF 格式的會議紀錄
- [ ] 修改 Meeting detail UI 添加 "Download PDF" button
- [ ] **檔案變動：** `lib/meetings/pdf.ts`, `components/meetings/MeetingCard.tsx`
- **測試：** Minutes PDF tests

---

### 5.8 用戶群組
**原版功能：** 用户可以屬於多個群組；群組作為工作包受理人  
**現狀：** 只有用戶，沒有群組概念

**Task 5.8.1 — 群組數據模型**
- [ ] 新增 `Group` model（id, name, description）
- [ ] 新增 `GroupMember` model（groupId, userId）
- [ ] **檔案變動：** `prisma/schema.prisma`
- **migration:** `prisma migrate dev --name add_groups`

**Task 5.8.2 — 群組 API + UI**
- [ ] `pages/api/groups/` — CRUD
- [ ] `pages/admin/groups/index.tsx` — Admin UI
- [ ] 修改 `WorkPackageAssigneeSelect` 支持選擇 Group
- [ ] **檔案變動：** `pages/api/groups/`, `pages/admin/groups/`, `components/work-packages/`
- **測試：** Group CRUD tests

---

## 第六階段：測試覆蓋與文檔（第 43-48 周）

### 6.1 測試覆蓋補充
- [ ] 為所有新增功能添加 unit tests + integration tests
- [ ] 添加 E2E tests（Playwright）覆蓋關鍵 user flows
- [ ] API route tests 目標：每個 route 至少一個 happy path + 一個 error path
- [ ] 組件 tests 目標：每個 component 至少 render test + 一個 interaction test
- [ ] **檔案變動：** `__tests__/`

### 6.2 用戶指南截圖補充
- [ ] 為每個新功能拍攝截圖（每個功能每個 state 起碼 1-2 張）
- [ ] 更新 `docs/user-manual.md` 包含所有新功能文檔
- [ ] 目標：100+ 截圖覆蓋所有功能

### 6.3 性能優化
- [ ] API response time profiling
- [ ] Database query optimization（添加 index、優化 N+1）
- [ ] Frontend bundle size 優化
- [ ] Image/asset 優化

---

## 📅 預計時間表

| 階段 | 內容 | 預計周數 |
|------|------|---------|
| 第一階段 | 身份認証 + RBAC | 1-8 周 |
| 第二階段 | 工作包增強（Backlogs、Custom Fields、工作流、導出、Watchers）| 9-18 周 |
| 第三階段 | 項目管理增強（模板、複製、封存、版本、新聞）| 19-26 周 |
| 第四階段 | 集成 + 導出（Repository、Webhook、Email、Budgets）| 27-34 周 |
| 第五階段 | 其他功能（系統設置、增強 Wiki/Forum/My Page）| 35-42 周 |
| 第六階段 | 測試 + 文檔 + 性能 | 43-48 周 |

**總計：約 48 週（≈ 11-12 個月）**

---

## ⚠️ 風險與 tradeoffs

1. **Backlogs 複雜度被低估** — Sprint Planning board 涉及非常複雜的 drag-and-drop 邏輯和狀態管理，估計需要 6-8 周而非 4 周
2. **Custom Fields 對架構影響大** — 幾乎所有資源的 API 和 UI 都要修改，需要非常小心
3. **多人協作衝突** — 多個用戶同時編輯同一個 Work Package 或 Backlog 需要 optimistic locking
4. **Email deliverability** — 生產環境 Email 發送需要正確的 SPF/DKIM/DMARC 配置
5. **LDAP 調試困難** — 每個企業的 LDAP schema 不同，需要靈活的 field mapping
6. **測試覆蓋維護成本** — 每週新增功能都需要同步寫測試，否則技術債務快速累積
7. **48 週估計可能太樂觀** — 實際可能需要 18-24 個月，取決於團隊規模

---

## 🚀 建議優先順序

如果時間 / 資源有限，建議按以下順序實現：

1. **最高優先（核心功能）:** Backlogs > Custom Fields > PDF 導出 > Watchers > 項目模板
2. **高優先（企業必備）:** LDAP > OAuth > RBAC > 2FA > Budgets
3. **中優先（常用功能）:** Repository 集成 > Webhooks > Email Digest > 版本管理
4. **低優先（nice-to-have）:** News > Forum 增強 > Wiki 增強 > My Page 擴展
