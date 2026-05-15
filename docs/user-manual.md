# OpenProject 用戶手冊

> **版本：** 1.1 | **最後更新：** 2026-05-13
> **適用版本：** OpenProject Rewrite (Phase 1-6)

---

## 目錄

1. [登入與登出](#1-登入與登出)
2. [主頁（Landing Page）](#2-主頁landing-page)
3. [工作台（Dashboard）](#3-工作台dashboard)
4. [我的頁面（My Page）](#4-我的頁面my-page)
5. [通知中心（Notifications）](#5-通知中心notifications)
6. [項目列表](#6-項目列表)
7. [項目概覽](#7-項目概覽)
8. [項目設定](#8-項目設定)
9. [工作包（Work Packages）](#9-工作包work-packages)
10. [甘特圖視圖](#10-甘特圖視圖)
11. [看板視圖](#11-看板視圖)
12. [日曆視圖](#12-日曆視圖)
13. [工作包詳情](#13-工作包詳情)
14. [討論區（Forums）](#14-討論區forums)
15. [維基（Wiki）](#15-維基wiki)
16. [搜索](#16-搜索)

---

## 快速參考

| 項目 | 資料 |
|------|------|
| 演示用戶 | `demo@example.com` |
| 密碼 | `demo123` |
| 演示項目 ID | `cmo4ojw5r000gy8qxbipmo46s` |

> 💡 **提示：** 演示項目已預先載入範例工作包、論壇和維基頁面，方便快速探索所有功能。

---

## 1. 登入與登出

### 登入

前往系統，填寫登入資料：

- **Email address** — 你的帳戶電郵
- **Password** — 你的密碼
- **Remember me** — 勾選後保持登入狀態

點擊 **Sign in** 提交表單。成功後自動跳轉到工作台。

![登入頁面](images-manual/01-login-filled.png)

**登入表單（已填寫）**

填寫完成後的表單如圖所示，點擊 **Sign in** 即可登入。

![登入成功後儀表板](images-manual/01-dashboard.png)

**工作台儀表板**

登入成功後顯示工作台，包含項目概覽和最近的工作包。

---

## 2. 主頁（Landing Page）

未登入用戶訪問 `/` 會看到產品介紹頁，包含系統名稱與功能概述。

![主頁](images-manual/01-landing-hero.png)

**主頁截圖** — 展示系統標題與功能說明。向下滾動可查看更多介紹，頁面底部包含固定登入入口。

---

## 3. 工作台（Dashboard）

路徑：`/dashboard`

登入後自動進入工作台。頁面分為三個主要區塊：

**Projects Overview（項目概覽卡片）**
- 列出你參與的項目，顯示狀態徽章
- 狀態類型：`active`（綠色）、`on_hold`（黃色）、`archived`（灰色）
- 每個項目顯示：名稱、狀態、成員數
- 右側「View all」連結 → 項目列表頁

**Recent Work Packages（最近工作包卡片）**
- 列出最近建立或更新的工作包
- 每項顯示：工作包主題、狀態徽章、項目名稱

---

## 4. 我的頁面（My Page）

路徑：`/my-page`

個人化起始頁，可自訂顯示哪些小工具。

### 編輯佈局

點擊右上角 **Edit Layout** 按鈕進入編輯模式。此時每個 widget 右上角顯示刪除按鈕（×），底部顯示拖曳手柄。

![我的頁面](images-manual/12-my-page.png)

**編輯模式** — widget 可刪除或拖曳重新排列。

![編輯模式](images-manual/12-my-page-edit-mode.png)

完成編輯後點擊 **Done Editing** 保存。

### Widget 類型

**Assigned Work Packages**
- 顯示指派給你的工作包
- 每項顯示：主題、狀態、截止日期

**Time Entries This Week**
- 本週工作時間統計
- 顯示已記錄時數和目標時數

**Upcoming Meetings**
- 即將召開的會議列表
- 每項顯示：會議名稱、時間、項目

所有 widget 可折疊（點擊標題欄）或展開。

---

## 5. 通知中心（Notifications）

路徑：`/notifications`

右上角的**通知鈴鐺**（🔔）顯示未讀通知數量（最多顯示 99+）。

進入通知中心後：

**通知列表**
- 每條通知顯示：通知類型圖標、標題、摘要、發送時間
- 未讀通知以**粗體**顯示，左側有藍色圓點指示
- 點擊通知直接跳轉到相關頁面

**分頁導航（底部）**
- 「Page X of Y」顯示當前頁碼
- **Previous** / **Next** 按鈕切換頁面

**標記已讀**
- 右側 **Mark all read** 按鈕 — 一次過標記全部為已讀

![通知中心](images-manual/11-notifications.png)

**空狀態：** 暫無通知時顯示「No notifications yet」。

---

## 6. 項目列表

路徑：`/projects`

顯示所有你可訪問的項目。

![項目列表](images-manual/02-projects-list.png)

### 新建項目

點擊右上角 **New Project** 按鈕，彈出創建對話框：

![新建項目對話框](images-manual/02-new-project-dialog.png)

- **Project Name** — 項目名稱（必填）
- **Identifier** — URL 標識符（必填，自動轉為小寫並以連字符分隔）
- **Description** — 項目描述（可選）
- **Cancel** / **Create** 按鈕

### 項目表格

| 欄位 | 說明 |
|------|------|
| Name | 項目名稱，點擊進入項目概覽 |
| Identifier | URL 友好名稱 |
| Status | 狀態徽章 |
| Members | 成員數量 |
| Actions | **View** 按鈕 |

**項目卡片（懸停）**

滑鼠懸停在項目卡片上時，會顯示項目的詳細操作選項。

![項目卡片懸停](images-manual/02-project-card-hover.png)

---

## 7. 項目概覽

路徑：`/projects/[projectId]`

點擊項目名稱進入。

![項目概覽](images-manual/02-project-overview.png)

**頂部**
- 項目名稱（h1 大標題）
- 項目 Identifier（灰色小字）
- 狀態徽章
- 項目描述段落

**三張統計卡片**

點擊可跳轉到對應頁面：

| 卡片 | 內容 | 點擊效果 |
|------|------|---------|
| Work Packages | 工作包數量 | 跳轉到工作包列表 |
| Members | 成員數量 | 跳轉到設定 → 成員頁 |
| Versions | 版本數量 | （預留功能） |

![項目統計卡片](images-manual/02-project-overview-stats.png)

---

## 8. 項目設定

路徑：`/projects/[projectId]/settings`

分為三個 Tab：General / Modules / Members

### General（一般設定）

![一般設定](images-manual/03-settings-general.png)

可編輯以下欄位：

- **Project Name** — 項目名稱
- **Description** — 項目描述
- **Status** — 下拉選擇：`Active`、`On Hold`、`Archived`

**編輯狀態** — 正在修改項目名稱：

![編輯項目名稱](images-manual/03-settings-general-edit.png)

**保存成功** — 顯示綠色成功提示：

![保存成功](images-manual/03-settings-general-saved.png)

### Modules（模組設定）

![模組設定](images-manual/03-settings-modules.png)

9 個模組開關，預設全部開啟：

| 模組 | 說明 |
|------|------|
| Work Packages | 工作包管理 |
| Gantt Chart | 甘特圖時間線 |
| Board | 看板（Kanban） |
| Calendar | 日曆視圖 |
| Wiki | 維基頁面 |
| Forums | 討論區 |
| Documents | 文件管理 |
| Meetings | 會議管理 |
| Time Tracking | 時間追蹤 |

點擊 **Save Modules** 保存設定。

### Members（成員管理）

![成員管理](images-manual/03-settings-members.png)

**成員表格**

| 欄位 | 說明 |
|------|------|
| Name | 用戶頭像 + 姓名 |
| Email | 電郵地址 |
| Role | 角色徽章（Admin / Member / Viewer） |
| Actions | Edit Role / Remove 按鈕 |

**添加成員對話框**

點擊 **Add Member** 按鈕：

![添加成員對話框](images-manual/03-settings-add-member-dialog.png)

- 輸入 **User ID**（電郵地址）
- 選擇 **Role**（Admin / Member / Viewer）
- 點擊 **Add**

**編輯角色**

點擊成員行中的 **Edit Role**：

![編輯角色](images-manual/03-settings-edit-role.png)

---

## 9. 工作包（Work Packages）

路徑：`/projects/[projectId]/work-packages`

主要功能區分為四個視圖 Tab：Table / Gantt / Board / Calendar

### 表格視圖（Table）

![工作包表格](images-manual/04-wp-table.png)

**欄位列：** Subject | Status | Type | Priority | Assignee | Start Date | Due Date | Estimated Hours

**排序**

點擊欄位標題進行排序（ascending → descending → none）：

![工作包排序](images-manual/04-wp-table-sort.png)

**行懸停**

滑鼠懸停在行上時，該行高亮顯示：

![行懸停](images-manual/04-wp-table-row-hover.png)

**選擇行**

點擊左側勾選框選取該工作包，選中的行顯示選中狀態：

![選擇行](images-manual/04-wp-table-selected.png)

**新建工作包**

點擊右上角 **New Work Package** 按鈕：

![新建工作包對話框](images-manual/04-wp-new-dialog.png)

- **Subject** — 工作包主題（必填）
- **Description** — 詳細描述（可選，支援 Markdown）
- **Cancel** / **Create** 按鈕

**填寫完成** — 輸入主題後：

![新建工作包（已填寫）](images-manual/04-wp-new-dialog-filled.png)

**內聯編輯**

雙擊任意儲存格直接進入編輯模式，Enter 保存，Escape 取消：

![內聯編輯](images-manual/04-wp-inline-edit.png)

> 📝 **提示：** 雙擊儲存格後，編輯器即時響應；按 Enter 保存，Escape 取消。

---

## 10. 甘特圖視圖

在 **Table / Gantt / Board / Calendar** 切換 Tab 中選擇 **Gantt**。

![甘特圖](images-manual/05-gantt.png)

**時間縮放**

|| 按鈕 | 功能 |
||------|------|
|| Month | 月視圖（默認） |
|| Week | 週視圖（更精細） |

時間軸顯示橫軸為日期，每個工作包以橫條顯示，起止日期決定長度。

![甘特圖滾動](images-manual/05-gantt-scrolled.png)

**向右滾動** — 可查看更遠的時間線規劃。

**今日線** — 紅色垂直線標示今天的日期位置

**空狀態** — 該項目沒有工作包時：

![甘特圖空狀態](images-manual/05-gantt-empty.png)

---

## 11. 看板視圖

在 **Table / Gantt / Board / Calendar** 切換 Tab 中選擇 **Board**。

![看板](images-manual/06-board.png)

**Kanban 佈局**
- 每列代表一個 Status（如 New、In Progress、Closed）
- 工作包以卡片形式顯示，可拖曳到不同狀態列

**配置 WIP 限制對話框**

點擊右上角 **Configure WIP** 按鈕：

![配置 WIP 限制對話框](images-manual/06-board-wip-dialog.png)

為每個狀態列設定工作進行中（Work In Progress）上限。

**WIP 限制警告**

超過上限時，列頂部顯示黃色警告標示：「⚠️ Over limit」

![WIP 限制超標](images-manual/06-board-wip.png)

**新增工作包**

每列底部有固定疊加層「＋ Add card」，點擊直接輸入主題快速建立新工作包：

![新增卡片](images-manual/06-board-add-card.png)

---

## 12. 日曆視圖

在 **Table / Gantt / Board / Calendar** 切換 Tab 中選擇 **Calendar**。

![日曆](images-manual/07-calendar.png)

**月曆顯示**
- 標準月曆格式（7 列 × 5-6 行）
- 橫軸為星期（日至六），縱軸為日期

**工作包顯示**
- 有開始日期或截止日期的工作包顯示在對應日期儲存格
- 每個工作包顯示為小色塊，包含主題名稱
- 同一天多個工作包時垂直堆疊

**日曆 Header**
- 左右箭頭切換上 / 下月份
- 中央顯示當前年月

**切換到下個月：**

![日曆下月](images-manual/07-calendar-next-month.png)

**返回今天按鈕**

點擊 **Today** 按鈕快速返回當前月份：

![日曆今天](images-manual/07-calendar-today.png)

---

## 13. 工作包詳情

路徑：`/projects/[projectId]/work-packages/[id]`

點擊表格中的工作包連結進入詳情頁。

![工作包詳情](images-manual/08-wp-detail.png)

**麵包導航**
`← Back to List / 項目名 / 工作包主題`

**Header**
- Type 徽章（如 Task、Bug、Feature、Milestone，各自帶顏色）
- **Subject** — 可點擊內聯編輯

**Description**
- 點擊「Click to edit」進入編輯模式
- 支援 Markdown 格式
- Save / Cancel 按鈕

**Tabs**

| Tab | 內容 |
|-----|------|
| Activity | 活動時間流（建立、更新、評論） |
| Relations | 關係列表（Blocks、Blocked by、Precedes、Follows、Relates to） |

**Activity 標籤** — 顯示所有活動的時間序列：

![Activity](images-manual/08-wp-detail-activity.png)

**Relations 標籤** — 顯示工作包之間的關係：

![Relations](images-manual/08-wp-detail-relations.png)

**添加關係**

點擊 **Add Relation** 按鈕即可為工作包添加關係。

支援關係類型：Blocks、Blocked by、Precedes、Follows、Relates to

**右側屬性面板（Attribute Sidebar）**

|| 屬性 | 可編輯？ | 說明 |
||------|---------|------|
|| Status | ✅ 可編輯 | 下拉選擇狀態 |
|| Type | ✅ 可編輯 | Task / Bug / Feature / Milestone |
|| Priority | ✅ 可編輯 | Low / Normal / High |
|| Assignee | ✅ 可編輯 | 選擇團隊成員 |
|| Author | ❌ 只讀 | 建立者 |
|| Start Date | ✅ 可編輯 | 日期選擇器 |
|| Due Date | ✅ 可編輯 | 日期選擇器 |
|| Estimated Hours | ✅ 可編輯 | 數字輸入（0.25 為一單位） |
|| Created | ❌ 只讀 | 建立時間 |
|| Updated | ❌ 只讀 | 最後更新時間 |

![工作包詳情](images-manual/08-wp-detail-full.png)

---

## 14. 討論區（Forums）

路徑：`/projects/[projectId]/forums`

### 討論區列表

![討論區列表](images-manual/09-forums-list.png)

**操作按鈕**
- **New Forum** — 創建新討論區

**創建討論區對話框**

![新建討論區對話框](images-manual/09-new-forum-dialog.png)

- **Name** — 討論區名稱（必填）
- **Description** — 描述（可選）
- **Cancel** / **Create** 按鈕

**討論區表格**

| 欄位 | 說明 |
|------|------|
| Name | 討論區名稱，點擊進入詳情 |
| Author | 創建者 |
| Threads | 主題數量 |
| Created | 創建日期 |

### 討論串列表

點擊討論區名稱進入。

![討論串列表](images-manual/09-thread-list.png)

**操作按鈕**
- **New Thread** — 發表新主題

點擊 **New Thread** 按鈕，彈出創建對話框，可輸入主題標題後建立討論串。

**討論串表格**

| 欄位 | 說明 |
|------|------|
| Thread | 主題名稱，徽章（Sticky/Locked） |
| Author | 發表人 |
| Posts | 回覆數量 |
| Created | 發表時間 |

### 討論串詳情

點擊討論串進入。

![討論串詳情](images-manual/09-thread-detail.png)

顯示主題內容、發表人信息、創建時間，以及所有回覆。

**回覆功能**

點擊 **Reply** 按鈕即可回覆該討論串。

---

## 15. 維基（Wiki）

路徑：`/projects/[projectId]/wiki`

### 維基頁面列表

![維基頁面列表](images-manual/10-wiki-list.png)

**操作按鈕**
- **New Page** — 創建新頁面

**創建頁面對話框**

![新建維基頁面對話框](images-manual/10-new-page-dialog.png)

- **Title** — 頁面標題（必填）
- **Content** — 頁面內容（可選，支援 Markdown）
- **Cancel** / **Create** 按鈕

**頁面表格**

| 欄位 | 說明 |
|------|------|
| Title | 頁面標題，點擊進入詳情 |
| Author | 作者 |
| Children | 子頁面數量 |
| Updated | 最後更新時間 |

### 維基頁面詳情

點擊頁面標題進入。

![維基頁面](images-manual/10-wiki-page.png)

**頁面 Header**
- **Title** — 標題
- Author、Version、Updated 日期
- Parent page 連結（如有父頁面）

**操作按鈕（管理員 / 作者可見）**
- **Edit** — 進入編輯模式
- **Delete** — 刪除頁面

**編輯模式**

點擊 **Edit** 按鈕即可進入編輯模式：

![維基編輯模式](images-manual/10-wiki-edit-attempt.png)

**內容區塊**
- **檢視模式：** Markdown 渲染後的 HTML
- **編輯模式：** textarea，底部 Save / Cancel 按鈕

---

## 16. 搜索

路徑：`/projects/[projectId]/search`

![搜索頁面](images-manual/13-search.png)

**搜索框**
- 頁面頂部輸入關鍵字
- 輸入後自動搜尋（防抖）

**類型篩選膠囊按鈕**

| 按鈕 | 搜尋範圍 |
|------|---------|
| Wiki Pages | 維基頁面標題和內容 |
| Forums | 討論串和討論區名稱 |
| Documents | 文件標題和描述 |
| Meetings | 會議標題 |
| Work Packages | 工作包主題和描述 |

**搜尋結果**

![搜索結果](images-manual/13-search-results.png)

按類型分組顯示結果，每項顯示：類型圖標、標題、相關摘要、匹配內容片段。

**空狀態**
未輸入關鍵字時顯示「Enter a search term to find content in this project.」

---

## 附錄

### 鍵盤快捷鍵

| 快捷鍵 | 頁面 | 功能 |
|--------|------|------|
| Enter | 登入表單 | 提交表單 |
| Escape | 編輯模式 | 取消編輯 |
| Enter | 儲存格編輯 | 保存更改 |

### 狀態值參照

**項目狀態**

| 值 | 說明 | 徽章顏色 |
|----|------|---------|
| active | 進行中 | 綠色 |
| on_hold | 暫停 | 黃色 |
| archived | 已歸檔 | 灰色 |

**工作包狀態**

| 值 | 說明 |
|----|------|
| New | 新建立 |
| In Progress | 進行中 |
| Resolved | 已解決 |
| Closed | 已關閉 |

**工作包類型**

| 值 | 顏色 |
|----|------|
| Task | 藍色 |
| Bug | 紅色 |
| Feature | 紫色 |
| Milestone | 黃色 |

**成員角色**

| 值 | 說明 |
|----|------|
| Admin | 項目管理員，可管理所有設定 |
| Member | 普通成員，可編輯工作包 |
| Viewer | 檢視者，僅供查看 |

**時間條目狀態**

| 值 | 說明 |
|----|------|
| pending | 待提交 |
| submitted | 已提交 |
| approved | 已批准 |
| rejected | 已拒絕 |

---

*本文檔由 OpenProject Rewrite 自動生成 | 文件版本：1.0*
