# OmniNote

以平板電腦 + 手寫筆為主的全功能筆記應用程式，支援 PWA 離線使用。

**技術棧**：FastAPI · Uvicorn · PostgreSQL (asyncpg) · Preact 10（無需 build step）

---

## 功能特色

| 功能 | 說明 |
|------|------|
| 手寫輸入 | Pointer Events API，支援筆壓感應，貝茲曲線平滑筆跡，`getCoalescedEvents()` 補全高頻觸控點 |
| 螢光筆 | `multiply` 混合模式，半透明疊色效果 |
| 橡皮擦 | **精確模式**（逐點切除筆劃）／**整筆模式**（整條刪除），工具列一鍵切換 |
| 筆觸粗細 | 顏色按鈕旁的粗細按鈕，點擊後彈出拉桿即時調整；橡皮擦亦支援大小調整 |
| 套索選取 | 自由繪製選取區（Ray Casting 演算法），可拖曳移動選取筆跡 |
| 便利貼 | 可拖曳、縮放、換色、inline 富文字編輯 |
| 心智圖 | 雙擊空白新增節點、拖曳節點連線、貝茲弧線連接、節點顏色、刪除；心智圖與手寫可疊加 |
| 背景樣式 | 橫線 / 方格 / 點陣 / 空白，可自訂間距與線條粗細；支援上傳圖片當背景（存於 DB） |
| 縮放 | 頂欄縮放拉桿（10%–200%），支援平移（Pan 模式） |
| 多頁管理 | 底部分頁列，可新增手寫頁或心智圖頁；雙擊分頁標籤重新命名；可刪除頁面 |
| 自動儲存 | 停筆 800ms 後自動 PUT 到後端，頂部圓點顯示儲存狀態（橘＝未存，綠＝已存） |
| 匯出 | 匯出當前頁為 PNG，或匯出全本為 PDF |
| PWA | Service Worker cache-first，可加入主畫面離線使用 |

---

## 專案結構

```
omni-note/
├── main.py                  ← FastAPI 入口、背景圖片路由、靜態檔案掛載
├── database.py              ← SQLAlchemy async engine（PostgreSQL/asyncpg）、DB 遷移
├── models.py                ← ORM 模型：Notebook / Page / StickyNote
├── requirements.txt
├── routers/
│   ├── notebooks.py         ← CRUD /api/notebooks
│   ├── pages.py             ← CRUD /api/pages，筆跡、背景、背景圖片、心智圖、頁面標題
│   └── sticky_notes.py      ← CRUD /api/sticky-notes
└── static/
    ├── index.html           ← SPA 入口，內嵌所有 CSS
    ├── manifest.json        ← PWA manifest
    ├── sw.js                ← Service Worker（cache-first）
    └── js/
        ├── app.js           ← 主 App 元件、鍵盤快捷鍵、auto-save
        ├── store.js         ← useReducer 狀態管理、Undo/Redo
        ├── api.js           ← REST 客戶端（相對路徑，無 hardcode host）
        ├── canvas-utils.js  ← 筆跡渲染、橡皮擦、套索、背景繪製
        ├── export-utils.js  ← PNG / PDF 匯出（離屏 canvas）
        └── components/
            ├── Canvas.js        ← 手寫頁：雙 canvas 架構（base + overlay）
            ├── MindMapCanvas.js ← 心智圖頁：5 層架構（bg / SVG / nodes / stroke / overlay）
            ├── Toolbar.js       ← 工具列（筆、螢光筆、橡皮擦、套索、平移、心智圖、便利貼）
            ├── PageTabs.js      ← 底部分頁列（新增、刪除、重新命名）
            ├── StickyNote.js    ← 便利貼元件（拖曳、縮放、顏色、編輯）
            └── NotebookList.js  ← 筆記本列表
```

---

## 資料流

### 手寫筆跡

```
使用者繪圖
  → Pointer Events (getCoalescedEvents) → Canvas.js overlay canvas 即時預覽
  → pointerup → dispatch ADD_STROKE → store.js reducer → patchCurrentPage
  → Preact re-render → base canvas 重繪
  → scheduleSave (debounce 800ms) → api.updateStrokes → PUT /api/pages/:id/strokes
```

### 心智圖

```
雙擊空白處 → onSvgDblClick → 新增節點 → dispatch UPDATE_MINDMAP
拖曳 Port 圓點 → startConnect → onPortMove (tempCursor) → SVG 貝茲曲線預覽
  → pointerup on target Port → 建立連線 → dispatch UPDATE_MINDMAP
  → api.updateMindmap → PUT /api/pages/:id/mindmap
```

### 背景圖片

```
上傳 → POST /api/pages/:id/background-image（multipart）
     → 圖片 bytes 存入 pages.background_image_data（BYTEA）
     → MIME 存入 pages.background_image_mime
     → background_json 更新為 { type:"image", scale, ts }

讀取 → GET /backgrounds/:page_id
     → 從 DB 讀取 background_image_data + background_image_mime
     → 回傳 binary Response
```

---

## 資料庫結構

```
Notebook                Page                            StickyNote
────────────            ──────────────────────────────  ──────────────────────
id (PK)                 id (PK)                         id (PK)
title                   notebook_id (FK)                page_id (FK)
created_at              page_index                      x, y, width, height
updated_at              title                           content
                        strokes_json (TEXT)             color
                        background_json (TEXT)          created_at
                        background_image_data (BYTEA)   updated_at
                        background_image_mime (TEXT)
                        page_type
                        mindmap_json (TEXT)
                        created_at
                        updated_at
```

**strokes_json** — JSON 陣列，每筆格式：
```json
{ "id": "abc123", "tool": "pen", "color": "#1a1a2e", "width": 3,
  "points": [[x, y, pressure], ...] }
```

**mindmap_json** — 結構：
```json
{
  "nodes": [{ "id": "n-xxx", "x": 100, "y": 200, "width": 140, "height": 50,
              "text": "標題", "color": "white" }],
  "connections": [{ "id": "c-xxx", "sourceId": "n-xxx", "targetId": "n-yyy",
                    "sourcePort": "right", "targetPort": "left" }]
}
```

**background_json** — 範例：
```json
{ "type": "ruled", "spacing": 56, "thickness": 1 }
{ "type": "grid",  "spacing": 56, "thickness": 1 }
{ "type": "dot",   "spacing": 56, "size": 1.5 }
{ "type": "blank" }
{ "type": "image", "scale": 1.0, "ts": 1714000000000 }
```

`type: "image"` 時，實際圖片 bytes 存於 `background_image_data`；`ts` 用於前端快取破壞。

---

## API 端點

### 筆記本

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/notebooks` | 列出所有筆記本（含 page_count）|
| POST | `/api/notebooks` | 建立筆記本（同時建立第 1 頁）|
| GET | `/api/notebooks/:id` | 取得單一筆記本 |
| PUT | `/api/notebooks/:id` | 重新命名 |
| DELETE | `/api/notebooks/:id` | 刪除（cascade 所有頁面與便利貼）|

### 頁面

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/notebooks/:id/pages` | 列出所有頁面（含筆跡與便利貼）|
| POST | `/api/notebooks/:id/pages` | 新增頁面（`page_type`: `handwriting`\|`mindmap`）|
| PUT | `/api/pages/:id/strokes` | 更新筆跡 JSON |
| PUT | `/api/pages/:id/mindmap` | 更新心智圖 JSON |
| PUT | `/api/pages/:id/background` | 更新背景樣式 |
| PUT | `/api/pages/:id/title` | 更新頁面標題 |
| POST | `/api/pages/:id/background-image` | 上傳背景圖片（multipart/form-data，存入 DB）|
| DELETE | `/api/pages/:id/background-image` | 刪除背景圖片（清除 DB 欄位）|
| DELETE | `/api/pages/:id` | 刪除頁面（自動重新排序 page_index）|

### 便利貼

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/pages/:id/sticky-notes` | 新增便利貼 |
| PUT | `/api/sticky-notes/:id` | 更新（位置 / 尺寸 / 內容 / 顏色）|
| DELETE | `/api/sticky-notes/:id` | 刪除 |

### 背景圖片

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/backgrounds/:page_id` | 讀取背景圖片（從 DB 讀取，依 MIME 回傳）|

---

## 環境變數

| 變數 | 必填 | 說明 |
|------|------|------|
| `DATABASE_URL` | **必填** | PostgreSQL 連線字串（支援 `postgres://`、`postgresql://`、`postgresql+asyncpg://`）|
| `PORT` | 否（預設 `8000`）| HTTP 監聽埠位 |

`DATABASE_URL` 範例：
```
postgresql://user:password@localhost:5432/omni_note
postgres://user:password@db.example.com/omni_note   # Heroku / Railway 格式亦可
```

Neon、Render 等雲端 PostgreSQL 的 `sslmode=require` 與 `channel_binding` 參數已自動處理，直接貼上原始連線字串即可。

---

## 本地開發

### 環境需求

- Python 3.11+
- PostgreSQL 12+
- 不需要 Node.js（前端無 build step）

### 安裝與啟動

```bash
# 1. 建立虛擬環境
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

# 2. 安裝依賴
pip install -r requirements.txt

# 3. 建立資料庫（PostgreSQL）
createdb omni_note

# 4. 設定環境變數
export DATABASE_URL="postgresql://postgres:password@localhost/omni_note"
export PORT=8000                # 選填

# 5. 啟動開發伺服器（資料表會在啟動時自動建立）
uvicorn main:app --reload --port 8000

# 6. 開啟瀏覽器
# http://localhost:8000
```

---

## 技術細節

### 手寫頁：雙 Canvas 架構

```
┌─────────────────────────────────┐  zIndex: 11
│  overlay canvas (pointer events)│  ← 即時繪製中的筆跡 / 橡皮擦游標 / 套索框
├─────────────────────────────────┤  zIndex: 10
│  base canvas                    │  ← 已提交的所有筆跡（狀態變更時重繪）
└─────────────────────────────────┘
```

### 心智圖頁：5 層架構

```
┌─────────────────────────────────┐  zIndex: 11  overlay canvas（手寫）
├─────────────────────────────────┤  zIndex: 10  stroke canvas（已提交手寫）
├─────────────────────────────────┤  zIndex:  2  node divs（拖曳、Port 連線）
├─────────────────────────────────┤  zIndex:  1  SVG（貝茲弧線連線）
└─────────────────────────────────┘  zIndex:  0  bg canvas（背景）
```

### 精確橡皮擦演算法

1. 對每條筆跡逐點計算與橡皮擦圓心的距離
2. 落在橡皮擦半徑內的點被移除
3. 被切斷的筆跡自動拆分成多條子筆跡（各自擁有新 id）
4. 使用 debounce（500ms）將連續擦除合併為單一 Undo 記錄

### 套索選取演算法

使用 **Ray Casting**（射線法）判斷點是否在多邊形內：

```js
function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if (yi > py !== yj > py && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
```

### 心智圖連線幾何

- Port 位置：節點四邊中點（`top`、`right`、`bottom`、`left`）
- 貝茲控制點：距 Port 80px，方向與 Port 法向量一致
- 拖曳連線時即時顯示預覽弧線；所有節點的 Port 點同時高亮以引導定位

### 資料庫遷移策略

`database.py` 的 `init_db()` 在每次啟動時執行 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，無需額外遷移工具即可做到向前相容的欄位新增。

### PWA Service Worker 策略

- **靜態資源**（`/js/*`, `/icons/*`, `index.html`）：Cache First
- **API 請求**（`/api/*`）：Network Only
- 新版本部署時自動清除舊快取版本

---

## 鍵盤快捷鍵

| 按鍵 | 功能 |
|------|------|
| `P` | 切換鋼筆 |
| `H` | 切換螢光筆 |
| `E` | 切換橡皮擦 |
| `S` | 切換套索選取 |
| `N` | 新增便利貼 |
| `M` | 切換心智圖工具（心智圖頁）|
| `Ctrl + Z` | 復原 |
| `Ctrl + Y` / `Ctrl + Shift + Z` | 重做 |
| `Delete` / `Backspace` | 刪除選取節點或連線（心智圖工具）|
| `Escape` | 取消選取 / 取消編輯 |
