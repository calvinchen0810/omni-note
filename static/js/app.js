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
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.0;

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [notebooks, setNotebooks]   = useReducer((s, a) => a, []);
  const [zoom, setZoom] = useState(1);
  const saveTimerRef = useRef(null);
  const canvasViewportRef = useRef(null);
  const panSessionRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });

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
      const currentBg = state.pages[state.currentPageIndex]?.background;
      // Inherit non-image backgrounds; image files aren't copied to new pages
      const bg = currentBg?.type === "image" ? { type: "blank" } : (currentBg ?? { type: "blank" });
      const page = await api.createPage(state.notebook.id, bg);
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

  // ── Background ───────────────────────────────────────────────────────────

  async function handleUpdateBackground(bg) {
    const page = state.pages[state.currentPageIndex];
    if (!page) return;
    dispatch({ type: "UPDATE_PAGE_BACKGROUND", background: bg });
    try { await api.updateBackground(page.id, bg); } catch (e) { console.error(e); }
  }

  async function handleUploadBackgroundImage(file) {
    const page = state.pages[state.currentPageIndex];
    if (!page) return;
    try {
      const { background } = await api.uploadBackgroundImage(page.id, file);
      dispatch({ type: "UPDATE_PAGE_BACKGROUND", background });
    } catch (e) { console.error("uploadBackground:", e); }
  }

  async function handleRemoveBackgroundImage() {
    const page = state.pages[state.currentPageIndex];
    if (!page) return;
    dispatch({ type: "UPDATE_PAGE_BACKGROUND", background: { type: "blank" } });
    try { await api.deleteBackgroundImage(page.id); } catch (e) { console.error(e); }
  }

  // ── Export ───────────────────────────────────────────────────────────────

  async function handleExportPng(withBg) {
    const page = state.pages[state.currentPageIndex];
    if (!page) return;
    const name = `${state.notebook?.title ?? "note"}-第${state.currentPageIndex + 1}頁`;
    await exportCurrentPageAsPng(page, name, withBg);
  }

  async function handleExportPdf(withBg) {
    if (!state.pages.length) return;
    try {
      await exportAllPagesAsPdf(state.pages, state.notebook?.title ?? "note", withBg);
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

  const onViewportPointerDown = useCallback((e) => {
    if (state.currentTool !== "pan") return;
    if (e.pointerType === "touch" && !e.isPrimary) return;
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    e.preventDefault();
    viewport.setPointerCapture?.(e.pointerId);
    viewport.style.cursor = "grabbing";
    panSessionRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: viewport.scrollLeft,
      startTop: viewport.scrollTop,
    };
  }, [state.currentTool]);

  const onViewportPointerMove = useCallback((e) => {
    if (state.currentTool !== "pan") return;
    const viewport = canvasViewportRef.current;
    const sess = panSessionRef.current;
    if (!viewport || !sess.active || sess.pointerId !== e.pointerId) return;
    e.preventDefault();
    viewport.scrollLeft = sess.startLeft - (e.clientX - sess.startX);
    viewport.scrollTop = sess.startTop - (e.clientY - sess.startY);
  }, [state.currentTool]);

  const onViewportPointerUp = useCallback((e) => {
    const viewport = canvasViewportRef.current;
    const sess = panSessionRef.current;
    if (!viewport || !sess.active) return;
    if (typeof e?.pointerId === "number" && sess.pointerId !== e.pointerId) return;
    panSessionRef.current = { active: false, pointerId: null, startX: 0, startY: 0, startLeft: 0, startTop: 0 };
    viewport.style.cursor = state.currentTool === "pan" ? "grab" : "";
    if (typeof e?.pointerId === "number" && viewport.hasPointerCapture?.(e.pointerId)) {
      viewport.releasePointerCapture(e.pointerId);
    }
  }, [state.currentTool]);

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
      h("div", { class: "top-bar-leading" },
        h("button", { class: "btn-back", onClick: handleBack, title: "返回筆記本列表" },
          h("svg", { class: "btn-back-icon", viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 2 },
            h("path", { d: "M15 18l-6-6 6-6" }),
            h("path", { d: "M21 12H9" })
          ),
          h("span", { class: "btn-back-label" }, "返回")
        ),
        h("div", { class: "notebook-title" }, state.notebook?.title ?? "")
      ),
      h("div", { class: "top-bar-tools" },
        h(Toolbar, {
          state,
          dispatch,
          onAddStickyNote: handleAddStickyNote,
          onUndo: handleUndo,
          onRedo: handleRedo,
        })
      ),
      h("div", { class: "top-bar-actions" },
        h(ZoomMenu, { zoom, onZoom: updateZoom }),
        h(BackgroundPicker, {
          page: currentPage,
          onUpdate: handleUpdateBackground,
          onUploadImage: handleUploadBackgroundImage,
          onRemoveImage: handleRemoveBackgroundImage,
        }),
        h(ExportMenu, { onExportPng: handleExportPng, onExportPdf: handleExportPdf }),
        h("div", {
          class: "save-indicator",
          title: state.isDirty ? "未儲存" : "已儲存",
          "aria-label": state.isDirty ? "未儲存" : "已儲存",
        },
          h("span", {
            class: ["save-status-dot", state.isDirty ? "saving" : "saved"].join(" "),
          })
        )
      ),
    ),

    h("div", { class: "editor-main" },
      h("div", {
        class: ["canvas-wrapper", state.currentTool === "pan" && "is-pan-mode"].filter(Boolean).join(" "),
        ref: canvasViewportRef,
        style: { touchAction: state.currentTool === "pan" ? "none" : "auto" },
        onPointerDown: onViewportPointerDown,
        onPointerMove: onViewportPointerMove,
        onPointerUp: onViewportPointerUp,
        onPointerCancel: onViewportPointerUp,
        onPointerLeave: onViewportPointerUp,
      },
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
                  interactive: state.currentTool !== "pan",
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
      h("div", { class: "zoom-slider-header" },
        h("span", { class: "zoom-slider-value" }, `${Math.round(zoom * 100)}%`),
        h("button", {
          class: "zoom-reset",
          onClick: () => onZoom(1),
        }, "100%")
      ),
      h("input", {
        class: "zoom-slider",
        type: "range",
        min: 10,
        max: 200,
        step: 5,
        value: Math.round(zoom * 100),
        onInput: (e) => onZoom(Number(e.target.value) / 100),
      }),
      h("div", { class: "zoom-slider-scale" },
        h("span", null, "10%"),
        h("span", null, "200%")
      )
    ),
    open && h("div", { class: "export-backdrop", onClick: close })
  );
}

function ExportMenu({ onExportPng, onExportPdf }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [withBg, setWithBg] = useState(true);

  async function handlePng() {
    setOpen(false);
    setLoading(true);
    try {
      await onExportPng(withBg);
    } finally {
      setLoading(false);
    }
  }

  async function handlePdf() {
    setOpen(false);
    setLoading(true);
    try {
      await onExportPdf(withBg);
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
      h("label", { class: "export-bg-toggle" },
        h("input", {
          type: "checkbox",
          checked: withBg,
          onChange: (e) => setWithBg(e.target.checked),
        }),
        h("span", null, "包含背景")
      ),
      h("div", { class: "export-divider" }),
      h("button", {
        class: "export-item",
        onClick: handlePng,
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

// ── Background Picker ─────────────────────────────────────────────────────────

const BG_TYPES = [
  { type: "blank",  label: "空白" },
  { type: "ruled",  label: "橫線" },
  { type: "grid",   label: "方格" },
  { type: "dot",    label: "點陣" },
];

function BackgroundPicker({ page, onUpdate, onUploadImage, onRemoveImage }) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef(null);
  const updateTimerRef = useRef(null);

  const bg = page?.background ?? { type: "blank" };
  const isImage = bg.type === "image";
  const hasSliders = ["ruled", "grid", "dot"].includes(bg.type);

  function setType(type) {
    if (type === bg.type) return;
    const base = { spacing: bg.spacing ?? 56, thickness: bg.thickness ?? 1, size: bg.size ?? 1.5 };
    const next = type === "blank" ? { type: "blank" }
      : type === "dot"   ? { type: "dot",   spacing: base.spacing, size: base.size }
      : { type, spacing: base.spacing, thickness: base.thickness };
    onUpdate(next);
  }

  function updateParam(key, value) {
    clearTimeout(updateTimerRef.current);
    const next = { ...bg, [key]: value };
    onUpdate(next);
  }

  return h("div", { class: "bg-menu-wrap" },
    h("button", {
      class: ["icon-btn", open && "active"].filter(Boolean).join(" "),
      title: "背景",
      onClick: () => setOpen(!open),
    },
      h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 2 },
        h("rect", { x: 3, y: 3, width: 18, height: 18, rx: 2 }),
        h("path", { d: "M3 9h18" }),
        h("path", { d: "M9 21V9" })
      )
    ),
    open && h("div", { class: "bg-dropdown" },

      h("div", { class: "bg-section-label" }, "樣式"),
      h("div", { class: "bg-type-row" },
        BG_TYPES.map(({ type, label }) =>
          h("button", {
            key: type,
            class: ["bg-type-btn", bg.type === type && "active"].filter(Boolean).join(" "),
            onClick: () => setType(type),
          }, label)
        )
      ),

      hasSliders && h("div", { class: "bg-sliders" },
        h("div", { class: "bg-slider-row" },
          h("span", { class: "bg-slider-label" }, "間距"),
          h("input", {
            type: "range", min: 20, max: 100, step: 2,
            value: bg.spacing ?? 56,
            onInput: (e) => updateParam("spacing", +e.target.value),
          }),
          h("span", { class: "bg-slider-value" }, `${bg.spacing ?? 56}px`)
        ),
        bg.type === "dot"
          ? h("div", { class: "bg-slider-row" },
              h("span", { class: "bg-slider-label" }, "點大小"),
              h("input", {
                type: "range", min: 0.5, max: 4, step: 0.5,
                value: bg.size ?? 1.5,
                onInput: (e) => updateParam("size", +e.target.value),
              }),
              h("span", { class: "bg-slider-value" }, `${bg.size ?? 1.5}`)
            )
          : h("div", { class: "bg-slider-row" },
              h("span", { class: "bg-slider-label" }, "粗細"),
              h("input", {
                type: "range", min: 0.5, max: 3, step: 0.5,
                value: bg.thickness ?? 1,
                onInput: (e) => updateParam("thickness", +e.target.value),
              }),
              h("span", { class: "bg-slider-value" }, `${bg.thickness ?? 1}px`)
            )
      ),

      h("div", { class: "bg-divider" }),
      h("div", { class: "bg-section-label" }, "背景圖片"),

      isImage
        ? h("div", { class: "bg-sliders" },
            h("div", { class: "bg-slider-row" },
              h("span", { class: "bg-slider-label" }, "縮放"),
              h("input", {
                type: "range", min: 20, max: 200, step: 5,
                value: Math.round((bg.scale ?? 1) * 100),
                onInput: (e) => updateParam("scale", +e.target.value / 100),
              }),
              h("span", { class: "bg-slider-value" }, `${Math.round((bg.scale ?? 1) * 100)}%`)
            ),
            h("button", {
              class: "bg-remove-btn",
              onClick: () => { onRemoveImage(); setOpen(false); },
            }, "移除圖片")
          )
        : h("button", {
            class: "bg-upload-btn",
            onClick: () => fileInputRef.current?.click(),
          }, "上傳圖片"),

      h("input", {
        ref: fileInputRef,
        type: "file",
        accept: "image/jpeg,image/png,image/gif,image/webp",
        style: { display: "none" },
        onChange: (e) => {
          const file = e.target.files?.[0];
          if (file) { onUploadImage(file); e.target.value = ""; setOpen(false); }
        },
      })
    ),
    open && h("div", { class: "export-backdrop", onClick: () => setOpen(false) })
  );
}

render(h(App, null), document.getElementById("app"));
