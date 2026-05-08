import { h, render } from "https://esm.sh/preact@10.19.3";
import { useReducer, useEffect, useCallback, useRef, useState } from "https://esm.sh/preact@10.19.3/hooks";

import { initialState, reducer } from "./store.js";
import { api } from "./api.js";
import { uid } from "./canvas-utils.js";

import { NotebookList } from "./components/NotebookList.js";
import { Canvas }       from "./components/Canvas.js";
import { Toolbar }      from "./components/Toolbar.js";
import { PageTabs }     from "./components/PageTabs.js";
import { StickyNote }   from "./components/StickyNote.js";
import { exportCurrentPageAsPng, exportAllPagesAsPdf } from "./export-utils.js";

const PAGE_WIDTH = 1200;
const PAGE_HEIGHT = 1700;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [notebooks, setNotebooks]   = useReducer((s, a) => a, []);
  const [zoom, setZoom] = useState(1);
  const saveTimerRef = useRef(null);

  // ── Load notebooks on mount ───────────────────────────────────────────────

  useEffect(() => { loadNotebooks(); }, []);

  async function loadNotebooks() {
    try {
      const list = await api.listNotebooks();
      setNotebooks(list);
    } catch (e) {
      console.error("loadNotebooks:", e);
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e) {
      if (state.view !== "editor") return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z") { e.preventDefault(); handleUndo(); }
      if (ctrl && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
        e.preventDefault(); handleRedo();
      }
      if (!ctrl && !e.altKey) {
        if (e.key === "p") dispatch({ type: "SET_TOOL", tool: "pen" });
        if (e.key === "h") dispatch({ type: "SET_TOOL", tool: "highlighter" });
        if (e.key === "e") dispatch({ type: "SET_TOOL", tool: "eraser" });
        if (e.key === "s") dispatch({ type: "SET_TOOL", tool: "select" });
        if (e.key === "n") handleAddStickyNote();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.view, state.undoStack, state.redoStack]);

  // ── Auto-save (debounced) ─────────────────────────────────────────────────

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveCurrentPage(), 800);
  }, [state.pages, state.currentPageIndex]);

  async function saveCurrentPage() {
    const page = state.pages[state.currentPageIndex];
    if (!page) return;
    try {
      await api.updateStrokes(page.id, page.strokes ?? []);
      dispatch({ type: "MARK_SAVED" });
    } catch (e) {
      console.error("save strokes:", e);
    }
  }

  // ── Notebook actions ──────────────────────────────────────────────────────

  async function handleOpenNotebook(nb) {
    try {
      const pages = await api.listPages(nb.id);
      dispatch({ type: "OPEN_EDITOR", notebook: nb, pages });
    } catch (e) {
      console.error("openNotebook:", e);
    }
  }

  async function handleCreateNotebook(title) {
    try {
      const nb = await api.createNotebook(title);
      await loadNotebooks();
      handleOpenNotebook(nb);
    } catch (e) {
      console.error("createNotebook:", e);
    }
  }

  async function handleDeleteNotebook(id) {
    try {
      await api.deleteNotebook(id);
      await loadNotebooks();
    } catch (e) {
      console.error("deleteNotebook:", e);
    }
  }

  async function handleRenameNotebook(id, title) {
    try {
      await api.updateNotebook(id, title);
      dispatch({ type: "UPDATE_NOTEBOOK_TITLE", title });
      await loadNotebooks();
    } catch (e) {
      console.error("renameNotebook:", e);
    }
  }

  // ── Page actions ──────────────────────────────────────────────────────────

  async function handleAddPage() {
    if (!state.notebook) return;
    try {
      const page = await api.createPage(state.notebook.id);
      dispatch({ type: "ADD_PAGE", page });
    } catch (e) {
      console.error("addPage:", e);
    }
  }

  async function handleDeletePage(pageId) {
    try {
      await api.deletePage(pageId);
      dispatch({ type: "DELETE_PAGE", pageId });
    } catch (e) {
      console.error("deletePage:", e);
    }
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  function handleUndo() { dispatch({ type: "UNDO" }); scheduleSave(); }
  function handleRedo() { dispatch({ type: "REDO" }); scheduleSave(); }

  // ── Sticky notes ──────────────────────────────────────────────────────────

  async function handleAddStickyNote() {
    const page = state.pages[state.currentPageIndex];
    if (!page) return;
    try {
      const note = await api.createStickyNote(page.id, {
        x: 80 + Math.random() * 200,
        y: 80 + Math.random() * 200,
        width: 220,
        height: 160,
        content: "",
        color: "#fff6bf",
      });
      dispatch({ type: "ADD_STICKY_NOTE", note });
    } catch (e) {
      console.error("addStickyNote:", e);
    }
  }

  async function handleUpdateStickyNote(id, patch) {
    dispatch({ type: "UPDATE_STICKY_NOTE", note: { id, ...patch } });
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try { await api.updateStickyNote(id, patch); } catch (e) { console.error(e); }
    }, 600);
  }

  async function handleDeleteStickyNote(id) {
    dispatch({ type: "REMOVE_STICKY_NOTE", id });
    try { await api.deleteStickyNote(id); } catch (e) { console.error(e); }
  }

  // ── Export ───────────────────────────────────────────────────────────────

  function handleExportPng() {
    const page = state.pages[state.currentPageIndex];
    if (!page) return;
    const name = `${state.notebook?.title ?? "note"}-第${state.currentPageIndex + 1}頁`;
    exportCurrentPageAsPng(page, name);
  }

  async function handleExportPdf() {
    if (!state.pages.length) return;
    try {
      await exportAllPagesAsPdf(state.pages, state.notebook?.title ?? "note");
    } catch (e) {
      console.error("export pdf:", e);
      alert("PDF 匯出失敗，請確認網路連線後再試。");
    }
  }

  // ── Back to list ──────────────────────────────────────────────────────────

  async function handleBack() {
    await saveCurrentPage();
    dispatch({ type: "BACK_TO_LIST" });
    await loadNotebooks();
  }

  function updateZoom(next) {
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next)));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (state.view === "list") {
    return h("div", { class: "app" },
      h(NotebookList, {
        notebooks,
        onOpen:   handleOpenNotebook,
        onCreate: handleCreateNotebook,
        onDelete: handleDeleteNotebook,
        onRename: handleRenameNotebook,
      })
    );
  }

  const currentPage = state.pages[state.currentPageIndex];

  return h("div", { class: "app editor" },
    h("div", { class: "top-bar" },
      h("button", { class: "btn-back", onClick: handleBack }, "← 返回"),
      h("div", { class: "notebook-title" }, state.notebook?.title ?? ""),
      h("div", { class: "top-bar-tools" },
        h(Toolbar, {
          state,
          dispatch,
          onAddStickyNote: handleAddStickyNote,
          onUndo: handleUndo,
          onRedo: handleRedo,
        })
      ),
      h("div", { class: "save-indicator" },
        state.isDirty
          ? h("span", { class: "saving" }, "未儲存")
          : h("span", { class: "saved" }, "✓ 已儲存")
      ),
      h(ZoomMenu, { zoom, onZoom: updateZoom }),
      h(ExportMenu, { onExportPng: handleExportPng, onExportPdf: handleExportPdf })
    ),

    h("div", { class: "editor-main" },
      h("div", { class: "canvas-wrapper" },
        h("div", { class: "page-stage" },
          h("div", {
            class: "page-zoom-layer",
            style: {
              width: `${Math.round(PAGE_WIDTH * zoom)}px`,
              height: `${Math.round(PAGE_HEIGHT * zoom)}px`,
            },
          },
            h("div", {
              class: "page-content",
              style: {
                width: `${PAGE_WIDTH}px`,
                height: `${PAGE_HEIGHT}px`,
                transform: `scale(${zoom})`,
              },
            },
              h(Canvas, {
                state,
                dispatch,
                onSave: scheduleSave,
                pageWidth: PAGE_WIDTH,
                pageHeight: PAGE_HEIGHT,
              }),
              currentPage && (currentPage.sticky_notes ?? []).map((note) =>
                h(StickyNote, {
                  key: note.id,
                  note,
                  interactive: true,
                  zoom,
                  tool: state.currentTool,
                  penColor: state.penColor,
                  penWidth: state.penWidth,
                  highlighterColor: state.highlighterColor,
                  highlighterWidth: state.highlighterWidth,
                  eraserWidth: state.eraserWidth,
                  eraserMode: state.eraserMode,
                  onUpdate: (patch) => handleUpdateStickyNote(note.id, patch),
                  onDelete: () => handleDeleteStickyNote(note.id),
                })
              )
            )
          )
        )
      )
    ),

    h(PageTabs, {
      state,
      dispatch,
      onAddPage: handleAddPage,
      onDeletePage: handleDeletePage,
    })
  );
}

function ZoomMenu({ zoom, onZoom }) {
  const [open, setOpen] = useState(false);
  const presets = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  function close() {
    setOpen(false);
  }

  return h("div", { class: "zoom-menu-wrap" },
    h("button", {
      class: "icon-btn",
      title: `縮放 (${Math.round(zoom * 100)}%)`,
      onClick: () => setOpen(!open),
    },
      h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 2 },
        h("circle", { cx: 11, cy: 11, r: 8 }),
        h("line", { x1: 21, y1: 21, x2: 16.65, y2: 16.65 }),
        h("line", { x1: 11, y1: 8, x2: 11, y2: 14 }),
        h("line", { x1: 8, y1: 11, x2: 14, y2: 11 })
      )
    ),
    open && h("div", { class: "zoom-dropdown" },
      h("div", { class: "zoom-controls-row" },
        h("button", {
          class: "zoom-btn",
          onClick: () => onZoom(zoom - 0.1),
        }, "−"),
        h("button", {
          class: "zoom-value",
          onClick: () => { onZoom(1); close(); },
        }, `${Math.round(zoom * 100)}%`),
        h("button", {
          class: "zoom-btn",
          onClick: () => onZoom(zoom + 0.1),
        }, "+")
      ),
      h("div", { class: "zoom-presets" },
        presets.map((preset) =>
          h("button", {
            key: preset,
            class: ["zoom-preset", Math.abs(zoom - preset) < 0.01 && "active"].filter(Boolean).join(" "),
            onClick: () => {
              onZoom(preset);
              close();
            },
          }, `${Math.round(preset * 100)}%`)
        )
      )
    ),
    open && h("div", { class: "export-backdrop", onClick: close })
  );
}

function ExportMenu({ onExportPng, onExportPdf }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handlePdf() {
    setOpen(false);
    setLoading(true);
    try {
      await onExportPdf();
    } finally {
      setLoading(false);
    }
  }

  return h("div", { class: "export-menu-wrap" },
    h("button", {
      class: "icon-btn",
      title: "匯出",
      onClick: () => setOpen(!open),
      disabled: loading,
    },
      loading
        ? h("span", { style: "font-size:11px;font-weight:600" }, "…")
        : h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 2 },
            h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
            h("polyline", { points: "7 10 12 15 17 10" }),
            h("line", { x1: 12, y1: 15, x2: 12, y2: 3 })
          )
    ),
    open && h("div", { class: "export-dropdown" },
      h("button", {
        class: "export-item",
        onClick: () => {
          setOpen(false);
          onExportPng();
        },
      },
        h("span", { class: "export-icon" }, "🖼"),
        h("div", null,
          h("div", { class: "export-label" }, "匯出為圖片 (PNG)"),
          h("div", { class: "export-hint" }, "目前頁面")
        )
      ),
      h("button", {
        class: "export-item",
        onClick: handlePdf,
      },
        h("span", { class: "export-icon" }, "📄"),
        h("div", null,
          h("div", { class: "export-label" }, "匯出為 PDF"),
          h("div", { class: "export-hint" }, "所有頁面")
        )
      )
    ),
    open && h("div", { class: "export-backdrop", onClick: () => setOpen(false) })
  );
}

render(h(App, null), document.getElementById("app"));
