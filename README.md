# OmniNote

以平板電腦 + 手寫筆為主的全功能筆記應用程式，支援 PWA 離線使用。

**技術棧**：FastAPI · Uvicorn · SQLite · Preact + htm（無需 build）

---

## 功能特色

| 功能 | 說明 |
|------|------|
| 手寫輸入 | Pointer Events API，支援筆壓感應，貝茲曲線平滑筆跡 |
| 螢光筆 | `multiply` 混合模式，半透明疊色效果 |
| 橡皮擦 | **精確模式**（逐點切除筆劃）/ **整筆模式**（整條刪除），工具列一鍵切換 |
| 筆觸粗細 | 顏色按鈕旁的粗細按鈕，點擊後彈出拉桿即時調整；橡皮擦亦支援大小調整 |
| 復原 / 重做 | Command Pattern，無限層次 Undo / Redo |
| 套索選取 | 自由繪製選取區，Ray Casting 演算法，可拖曳移動選取筆跡 |
| 便利貼 | 可拖曳、縮放、換色、inline 編輯 |
| 分頁 | 底部分頁列，可新增 / 刪除頁面 |
| 自動儲存 | 停筆 800ms 後自動 PUT 到後端，頂部顯示儲存狀態 |
| PWA | Service Worker cache-first，可加入主畫面離線使用 |

---

## 專案結構

```
omni-note/                   ← AppCarrier src/ 目錄
├── main.py                  ← FastAPI 入口（uvicorn main:app）
├── database.py              ← SQLAlchemy async，DB 路徑從 __file__ 推導
├── models.py                ← Notebook / Page / StickyNote ORM 模型
├── requirements.txt
├── routers/
│   ├── notebooks.py         ← CRUD /api/notebooks
│   ├── pages.py             ← CRUD /api/pages，筆跡更新
│   └── sticky_notes.py      ← CRUD /api/sticky-notes
└── static/
    ├── index.html           ← SPA 入口，內嵌所有 CSS
    ├── manifest.json        ← PWA manifest
    ├── sw.js                ← Service Worker
    ├── icons/
    └── js/
        ├── app.js           ← 主 App 元件，鍵盤快捷鍵，auto-save
        ├── store.js         ← useReducer 狀態管理，Undo/Redo
        ├── api.js           ← REST 客戶端（相對路徑）
        ├── canvas-utils.js  ← 筆跡渲染、橡皮擦、套索算法
        └── components/
            ├── Canvas.js        ← 雙 canvas 架構（base + overlay）
            ├── Toolbar.js       ← 工具列
            ├── PageTabs.js      ← 底部分頁
            ├── StickyNote.js    ← 便利貼元件
            └── NotebookList.js  ← 筆記本列表
```

### 資料流

```
使用者繪圖
  → Pointer Events → Canvas.js（overlay canvas 即時預覽）
  → pointerup → dispatch ADD_STROKE → store.js reducer
  → patchCurrentPage → Preact re-render → base canvas 重繪
  → scheduleSave（debounce 800ms）→ api.updateStrokes → PUT /api/pages/:id/strokes
```

---

## 資料庫結構

```
Notebook          Page                  StickyNote
─────────         ──────────────        ──────────────────
id                id                    id
title             notebook_id (FK)      page_id (FK)
created_at        page_index            x, y, width, height
updated_at        strokes_json (TEXT)   content
                  created_at            color
                  updated_at            created_at / updated_at
```

- `strokes_json`：JSON 陣列，每條筆跡格式：
  ```json
  {
    "id": "abc123",
    "tool": "pen",
    "color": "#1a1a2e",
    "width": 3,
    "points": [[x, y, pressure], ...]
  }
  ```

---

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/notebooks` | 列出所有筆記本 |
| POST | `/api/notebooks` | 建立筆記本（同時建立第 1 頁）|
| PUT | `/api/notebooks/:id` | 重新命名 |
| DELETE | `/api/notebooks/:id` | 刪除（cascade） |
| GET | `/api/notebooks/:id/pages` | 列出所有頁面（含筆跡與便利貼）|
| POST | `/api/notebooks/:id/pages` | 新增頁面 |
| PUT | `/api/pages/:id/strokes` | 更新筆跡 |
| DELETE | `/api/pages/:id` | 刪除頁面（自動重新排序）|
| POST | `/api/pages/:id/sticky-notes` | 新增便利貼 |
| PUT | `/api/sticky-notes/:id` | 更新便利貼（位置 / 內容 / 顏色）|
| DELETE | `/api/sticky-notes/:id` | 刪除便利貼 |

---

## 本地開發

### 環境需求

- Python 3.11+
- 不需要 Node.js（前端無 build step）

### 安裝與啟動

```bash
# 1. 建立虛擬環境
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

# 2. 安裝依賴
pip install -r requirements.txt

# 3. 啟動開發伺服器
uvicorn main:app --reload --port 8000

# 4. 開啟瀏覽器
# http://localhost:8000
```

### 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PORT` | `8000` | 監聽埠位 |
| `DB_PATH` | `../data/db.sqlite` | SQLite 資料庫路徑 |

資料庫預設路徑從 `main.py` 的 `__file__` 向上一層推導，符合 AppCarrier 回滾安全規範：

```python
APP_ROOT = Path(__file__).resolve().parent.parent   # apps/{name}/
DATA_DIR = APP_ROOT / "data"
DB_PATH  = Path(os.getenv("DB_PATH", str(DATA_DIR / "db.sqlite")))
```

---

## AppCarrier 部署

平台會將程式碼部署到 `apps/{app-name}/src/`，資料庫位於 `apps/{app-name}/data/db.sqlite`（回滾不影響）。

啟動指令：
```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

---

## 鍵盤快捷鍵

| 按鍵 | 功能 |
|------|------|
| `P` | 切換鋼筆 |
| `H` | 切換螢光筆 |
| `E` | 切換橡皮擦 |
| `S` | 切換套索選取 |
| `N` | 新增便利貼 |
| `Ctrl + Z` | 復原 |
| `Ctrl + Y` / `Ctrl + Shift + Z` | 重做 |

---

## 技術細節

### Canvas 雙層架構

```
┌─────────────────────────────────┐
│  overlay canvas (pointer events)│  ← 即時繪製中的筆跡 / 橡皮擦游標 / 套索框
├─────────────────────────────────┤
│  base canvas                    │  ← 已提交的所有筆跡（狀態變更時重繪）
└─────────────────────────────────┘
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

### PWA Service Worker 策略

- **靜態資源**：Cache First（優先從快取讀取）
- **API 請求**（`/api/*`）：Network Only（永遠走網路）
- 新版本部署時自動清除舊快取
