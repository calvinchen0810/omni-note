import { h, render } from "https://esm.sh/preact@10.19.3";
import { useReducer, useEffect, useCallback, useRef, useState } from "https://esm.sh/preact@10.19.3/hooks";

import { initialState, reducer } from "./store.js";
import { api } from "./api.js";
import { uid, renderAllStrokes, drawPageBackground } from "./canvas-utils.js";

import { NotebookList } from "./components/NotebookList.js";
import { Canvas }          from "./components/Canvas.js";
import { MindMapCanvas }   from "./components/MindMapCanvas.js";
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
  const [cloudModal, setCloudModal] = useState(null); // "save" | "open" | { type:"open-by-id", id } | null
  const [conflictData, setConflictData] = useState(null);
  const saveTimerRef = useRef(null);
  const canvasViewportRef = useRef(null);
  const stateRef = useRef(state);
  const cloudProjectRef = useRef(null);
  const panSessionRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });

  // ── Keep refs current ─────────────────────────────────────────────────────

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { cloudProjectRef.current = state.cloudProject; }, [state.cloudProject]);

  // ── Load notebooks on mount + URL share-link detection ────────────────────

  useEffect(() => {
    loadNotebooks();
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("project");
    if (!projectId) return;
    history.replaceState({}, "", window.location.pathname);
    const recent = getRecentProjects();
    const found = recent.find((p) => p.id === projectId);
    if (found) {
      openCloudProject(found.id, found.password);
    } else {
      setCloudModal({ type: "open-by-id", id: projectId });
    }
  }, []);

  // ── Cloud sync (15 s interval) ────────────────────────────────────────────

  useEffect(() => {
    if (!state.cloudProject) return;
    const id = setInterval(() => doCloudSync(), 15000);
    return () => clearInterval(id);
  }, [state.cloudProject?.id]);

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
        if (e.key === "m" && currentPage?.page_type === "mindmap") dispatch({ type: "SET_TOOL", tool: "mindmap" });
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
    if (state.cloudProject) return; // cloud mode: sync handled by interval
    const page = state.pages[state.currentPageIndex];
    if (!page) return;
    try {
      if (page.page_type === "mindmap") {
        await Promise.all([
          api.updateStrokes(page.id, page.strokes ?? []),
          api.updateMindmap(page.id, page.mindmap ?? { nodes: [], connections: [] }),
        ]);
      } else {
        await api.updateStrokes(page.id, page.strokes ?? []);
      }
      dispatch({ type: "MARK_SAVED" });
    } catch (e) {
      console.error("save page:", e);
    }
  }

  // ── Notebook actions ──────────────────────────────────────────────────────

  async function handleOpenNotebook(nb) {
    try {
      const pages = await api.listPages(nb.id);
      dispatch({ type: "OPEN_EDITOR", notebook: nb, pages });
      // auto-select mindmap tool if first page is mindmap
      if (pages[0]?.page_type === "mindmap") {
        dispatch({ type: "SET_TOOL", tool: "mindmap" });
      }
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

  async function handleAddPage(pageType = "handwriting") {
    const currentBg = state.pages[state.currentPageIndex]?.background;
    const bg = currentBg?.type === "image" ? { type: "blank" } : (currentBg ?? { type: "blank" });
    const tempId = `tmp-${Date.now()}`;
    const tempPage = { id: tempId, page_index: state.pages.length, strokes: [], sticky_notes: [], background: bg, page_type: pageType, mindmap: { nodes: [], connections: [] } };
    // Optimistic: show the tab immediately before the API responds
    dispatch({ type: "ADD_PAGE", page: tempPage });
    if (state.cloudProject) return;
    if (!state.notebook) return;
    try {
      const page = await api.createPage(state.notebook.id, bg, pageType);
      dispatch({ type: "REPLACE_PAGE", tempId, page });
    } catch (e) {
      console.error("addPage:", e);
    }
  }

  async function handleDeletePage(pageId) {
    if (state.cloudProject) {
      dispatch({ type: "DELETE_PAGE", pageId });
      return;
    }
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
    if (state.cloudProject) {
      dispatch({ type: "ADD_STICKY_NOTE", note: { id: `tmp-${Date.now()}`, page_id: page.id, x: 80 + Math.random() * 200, y: 80 + Math.random() * 200, width: 220, height: 160, content: "", color: "#fff6bf" } });
      return;
    }
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
    if (state.cloudProject) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try { await api.updateStickyNote(id, patch); } catch (e) { console.error(e); }
    }, 600);
  }

  async function handleDeleteStickyNote(id) {
    dispatch({ type: "REMOVE_STICKY_NOTE", id });
    if (!state.cloudProject) {
      try { await api.deleteStickyNote(id); } catch (e) { console.error(e); }
    }
  }

  // ── Background ───────────────────────────────────────────────────────────

  async function handleUpdateBackground(bg) {
    const page = state.pages[state.currentPageIndex];
    if (!page) return;
    dispatch({ type: "UPDATE_PAGE_BACKGROUND", background: bg });
    if (!state.cloudProject) {
      try { await api.updateBackground(page.id, bg); } catch (e) { console.error(e); }
    }
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

  // ── Cloud project helpers ─────────────────────────────────────────────────

  function getRecentProjects() {
    try { return JSON.parse(localStorage.getItem("omni-note-cloud") ?? "[]"); }
    catch { return []; }
  }

  function saveRecentProject(proj) {
    const list = getRecentProjects().filter((p) => p.id !== proj.id);
    list.unshift(proj);
    localStorage.setItem("omni-note-cloud", JSON.stringify(list.slice(0, 10)));
  }

  function removeRecentProject(id) {
    localStorage.setItem("omni-note-cloud", JSON.stringify(getRecentProjects().filter((p) => p.id !== id)));
  }

  async function openCloudProject(id, password) {
    try {
      const result = await api.cloudOpen(id, password);
      const pages = result.data?.pages ?? [];
      const cp = { id: result.id, name: result.name, password, updatedAt: result.updated_at };
      saveRecentProject(cp);
      dispatch({ type: "OPEN_CLOUD_EDITOR", name: result.name, pages, cloudProject: cp });
    } catch (e) {
      const status = e.message.match(/\d{3}/)?.[0];
      throw new Error(status === "403" ? "密碼錯誤" : status === "404" ? "找不到此專案" : "開啟失敗，請稍後再試");
    }
  }

  async function pushToCloud(cp, pages) {
    const result = await api.cloudSave(cp.id, cp.name, cp.password, { pages });
    const newCp = { ...cp, updatedAt: result.updated_at };
    dispatch({ type: "SET_CLOUD_PROJECT", project: newCp });
    dispatch({ type: "MARK_SAVED" });
    saveRecentProject(newCp);
    return newCp;
  }

  async function doCloudSync() {
    const cp = cloudProjectRef.current;
    const s = stateRef.current;
    if (!cp) return;
    try {
      const meta = await api.cloudMeta(cp.id, cp.password);
      const serverTime = new Date(meta.updated_at).getTime();
      const localTime  = new Date(cp.updatedAt).getTime();
      const dirty = s.isDirty;

      if (serverTime > localTime) {
        if (dirty) {
          const cloudData = await api.cloudOpen(cp.id, cp.password);
          setConflictData({ localPages: s.pages, cloudPages: cloudData.data?.pages ?? [], cloudUpdatedAt: meta.updated_at, cp });
        } else {
          const cloudData = await api.cloudOpen(cp.id, cp.password);
          const newCp = { ...cp, updatedAt: meta.updated_at };
          dispatch({ type: "OPEN_CLOUD_EDITOR", name: cp.name, pages: cloudData.data?.pages ?? [], cloudProject: newCp });
        }
      } else if (dirty) {
        await pushToCloud(cp, s.pages);
      }
    } catch (e) {
      console.error("cloud sync:", e);
    }
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
          pageType: currentPage?.page_type ?? "handwriting",
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
        h(CloudButtons, {
          cloudProject: state.cloudProject,
          onSave: () => setCloudModal("save"),
          onOpen: () => setCloudModal("open"),
        }),
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
        style: { touchAction: (state.currentTool === "pan" || currentPage?.page_type === "mindmap") ? "none" : "auto" },
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
              currentPage?.page_type === "mindmap"
                ? h(MindMapCanvas, {
                    state,
                    dispatch,
                    onSave: scheduleSave,
                    pageWidth: PAGE_WIDTH,
                    pageHeight: PAGE_HEIGHT,
                  })
                : h(Canvas, {
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
    }),

    cloudModal === "save" && h(SaveCloudModal, {
      cloudProject: state.cloudProject,
      pages: state.pages,
      onClose: () => setCloudModal(null),
      onSaved: (cp) => {
        dispatch({ type: "SET_CLOUD_PROJECT", project: cp });
        dispatch({ type: "MARK_SAVED" });
        saveRecentProject(cp);
        setCloudModal(null);
      },
    }),

    (cloudModal === "open" || (cloudModal?.type === "open-by-id")) && h(OpenCloudModal, {
      initialId: cloudModal?.id ?? null,
      onClose: () => setCloudModal(null),
      onOpened: (id, password) => {
        setCloudModal(null);
        openCloudProject(id, password).catch(() => {});
      },
      onRemove: (id) => removeRecentProject(id),
    }),

    conflictData && h(ConflictModal, {
      ...conflictData,
      onKeepLocal: async () => {
        const cp = conflictData.cp;
        try {
          await pushToCloud(cp, conflictData.localPages);
        } catch (e) { console.error(e); }
        setConflictData(null);
      },
      onUseCloud: () => {
        const cp = { ...conflictData.cp, updatedAt: conflictData.cloudUpdatedAt };
        dispatch({ type: "OPEN_CLOUD_EDITOR", name: cp.name, pages: conflictData.cloudPages, cloudProject: cp });
        saveRecentProject(cp);
        setConflictData(null);
      },
    }),
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

// ── Cloud UI components ───────────────────────────────────────────────────────

function CloudButtons({ cloudProject, onSave, onOpen }) {
  return h("div", { class: "cloud-btn-group" },
    h("button", {
      class: ["icon-btn", cloudProject ? "cloud-active" : ""].filter(Boolean).join(" "),
      title: cloudProject ? `儲存到雲端 (${cloudProject.name})` : "儲存到雲端",
      onClick: onSave,
    },
      h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 2 },
        h("path", { d: "M18 10a6 6 0 0 0-11.9-1A4 4 0 1 0 6 17h12a4 4 0 0 0 0-8" }),
        h("polyline", { points: "12 12 12 20" }),
        h("polyline", { points: "9 17 12 20 15 17" })
      ),
      cloudProject && h("span", { class: "cloud-dot" })
    ),
    h("button", {
      class: "icon-btn",
      title: "開啟雲端專案",
      onClick: onOpen,
    },
      h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 2 },
        h("path", { d: "M18 10a6 6 0 0 0-11.9-1A4 4 0 1 0 6 17h12a4 4 0 0 0 0-8" }),
        h("polyline", { points: "12 14 12 22" }),
        h("polyline", { points: "9 19 12 22 15 19" })
      )
    )
  );
}

function SaveCloudModal({ cloudProject, pages, onClose, onSaved }) {
  const [name, setName] = useState(cloudProject?.name ?? "");
  const [password, setPassword] = useState(cloudProject?.password ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shareId, setShareId] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !password.trim()) { setError("請填寫名稱和密碼"); return; }
    setLoading(true); setError("");
    try {
      const result = await api.cloudSave(cloudProject?.id ?? null, name.trim(), password, { pages });
      const cp = { id: result.id, name: name.trim(), password, updatedAt: result.updated_at };
      setShareId(result.id);
      onSaved(cp);
    } catch (e) {
      setError(e.message.includes("403") ? "密碼錯誤，無法覆蓋" : "儲存失敗，請稍後再試");
    } finally { setLoading(false); }
  }

  const shareUrl = shareId ? `${location.origin}/?project=${shareId}` : null;

  return h("div", { class: "cloud-overlay" },
    h("div", { class: "cloud-modal" },
      h("div", { class: "cloud-modal-header" },
        h("span", { class: "cloud-modal-title" }, "儲存到雲端"),
        h("button", { class: "cloud-modal-close", onClick: onClose }, "✕")
      ),
      shareUrl
        ? h("div", { class: "cloud-share-box" },
            h("p", { class: "cloud-share-label" }, "✅ 儲存成功！分享連結："),
            h("div", { class: "cloud-share-row" },
              h("input", { class: "cloud-share-input", readOnly: true, value: shareUrl }),
              h("button", { class: "cloud-copy-btn", onClick: () => navigator.clipboard.writeText(shareUrl) }, "複製")
            )
          )
        : h("form", { onSubmit: handleSubmit },
            h("label", { class: "cloud-field" },
              h("span", null, "專案名稱"),
              h("input", { class: "cloud-input", type: "text", placeholder: "我的專案", value: name, onInput: (e) => setName(e.target.value), autoFocus: true })
            ),
            h("label", { class: "cloud-field" },
              h("span", null, "密碼"),
              h("input", { class: "cloud-input", type: "password", placeholder: "設定存取密碼", value: password, onInput: (e) => setPassword(e.target.value) })
            ),
            error && h("p", { class: "cloud-error" }, error),
            h("div", { class: "cloud-modal-footer" },
              h("button", { type: "button", class: "cloud-btn-cancel", onClick: onClose }, "取消"),
              h("button", { type: "submit", class: "cloud-btn-primary", disabled: loading }, loading ? "儲存中…" : "儲存")
            )
          )
    )
  );
}

function OpenCloudModal({ initialId, onClose, onOpened, onRemove }) {
  const [recentList, setRecentList] = useState(() => {
    try { return JSON.parse(localStorage.getItem("omni-note-cloud") ?? "[]"); } catch { return []; }
  });
  const [manualId, setManualId] = useState(initialId ?? "");
  const [manualPw, setManualPw] = useState("");
  const [loading, setLoading] = useState(null); // project id or "manual"
  const [error, setError] = useState("");

  async function openRecent(proj) {
    setLoading(proj.id); setError("");
    try { onOpened(proj.id, proj.password); }
    catch { setError("開啟失敗"); }
    finally { setLoading(null); }
  }

  async function openManual(e) {
    e.preventDefault();
    if (!manualId.trim() || !manualPw.trim()) { setError("請填寫 ID 和密碼"); return; }
    setLoading("manual"); setError("");
    try { onOpened(manualId.trim().toUpperCase(), manualPw); }
    catch { setError("開啟失敗"); }
    finally { setLoading(null); }
  }

  function doRemove(id) {
    onRemove(id);
    setRecentList((l) => l.filter((p) => p.id !== id));
  }

  function fmtDate(s) {
    try { return new Date(s).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  }

  return h("div", { class: "cloud-overlay" },
    h("div", { class: "cloud-modal" },
      h("div", { class: "cloud-modal-header" },
        h("span", { class: "cloud-modal-title" }, "開啟雲端專案"),
        h("button", { class: "cloud-modal-close", onClick: onClose }, "✕")
      ),
      recentList.length > 0 && h("div", null,
        h("p", { class: "cloud-section-label" }, "最近使用"),
        recentList.map((proj) =>
          h("div", { key: proj.id, class: "cloud-recent-row" },
            h("div", { class: "cloud-recent-info" },
              h("span", { class: "cloud-recent-name" }, proj.name),
              h("span", { class: "cloud-recent-date" }, fmtDate(proj.updatedAt))
            ),
            h("div", { class: "cloud-recent-actions" },
              h("button", {
                class: "cloud-btn-sm cloud-btn-primary",
                disabled: loading === proj.id,
                onClick: () => openRecent(proj),
              }, loading === proj.id ? "…" : "開啟"),
              h("button", { class: "cloud-btn-sm cloud-btn-danger", onClick: () => doRemove(proj.id) }, "刪除")
            )
          )
        ),
        h("div", { class: "cloud-divider" })
      ),
      h("p", { class: "cloud-section-label" }, initialId ? "輸入密碼開啟分享連結" : "輸入 ID 和密碼"),
      h("form", { onSubmit: openManual },
        h("div", { class: "cloud-id-row" },
          h("input", { class: "cloud-input", style: "width:120px", placeholder: "專案 ID", value: manualId, onInput: (e) => setManualId(e.target.value) }),
          h("input", { class: "cloud-input", style: "flex:1", type: "password", placeholder: "密碼", value: manualPw, onInput: (e) => setManualPw(e.target.value), autoFocus: !!initialId })
        ),
        error && h("p", { class: "cloud-error" }, error),
        h("div", { class: "cloud-modal-footer" },
          h("button", { type: "button", class: "cloud-btn-cancel", onClick: onClose }, "取消"),
          h("button", { type: "submit", class: "cloud-btn-primary", disabled: loading === "manual" }, loading === "manual" ? "開啟中…" : "開啟")
        )
      )
    )
  );
}

function ConflictModal({ localPages, cloudPages, cloudUpdatedAt, cp, onKeepLocal, onUseCloud }) {
  const [localThumb, setLocalThumb] = useState(null);
  const [cloudThumb, setCloudThumb] = useState(null);

  async function renderThumb(page) {
    if (!page) return null;
    try {
      const w = 280, h = 396;
      const offscreen = document.createElement("canvas");
      offscreen.width = w; offscreen.height = h;
      const ctx = offscreen.getContext("2d");
      const bg = page.background ?? { type: "blank" };
      let bgImage = null;
      if (bg.type === "image") {
        bgImage = await new Promise((res) => {
          const img = new Image();
          img.onload = () => res(img); img.onerror = () => res(null);
          img.src = `/backgrounds/${page.id}?t=${bg.ts ?? 0}`;
        });
      }
      drawPageBackground(ctx, w, h, bg, bgImage);
      renderAllStrokes(ctx, page.strokes ?? []);
      return offscreen.toDataURL("image/png");
    } catch { return null; }
  }

  useEffect(() => {
    renderThumb(localPages[0]).then(setLocalThumb);
    renderThumb(cloudPages[0]).then(setCloudThumb);
  }, []);

  function fmtDate(s) {
    try { return new Date(s).toLocaleString("zh-TW"); } catch { return s; }
  }

  return h("div", { class: "cloud-overlay" },
    h("div", { class: "cloud-modal cloud-conflict-modal" },
      h("div", { class: "cloud-modal-header" },
        h("span", { class: "cloud-modal-title" }, "⚠️ 發現衝突版本"),
      ),
      h("p", { class: "cloud-conflict-hint" }, "本機與雲端同時有修改，請選擇要保留哪個版本："),
      h("div", { class: "cloud-conflict-thumbs" },
        h("div", { class: "cloud-conflict-side" },
          h("div", { class: "cloud-conflict-label" }, "本機版本"),
          localThumb
            ? h("img", { class: "cloud-thumb-img", src: localThumb })
            : h("div", { class: "cloud-thumb-placeholder" }, "載入中…"),
          h("button", { class: "cloud-btn-primary", style: "margin-top:10px; width:100%", onClick: onKeepLocal }, "保留本機版本")
        ),
        h("div", { class: "cloud-conflict-side" },
          h("div", { class: "cloud-conflict-label" }, `雲端版本 ${fmtDate(cloudUpdatedAt)}`),
          cloudThumb
            ? h("img", { class: "cloud-thumb-img", src: cloudThumb })
            : h("div", { class: "cloud-thumb-placeholder" }, "載入中…"),
          h("button", { class: "cloud-btn-cancel", style: "margin-top:10px; width:100%", onClick: onUseCloud }, "使用雲端版本")
        )
      )
    )
  );
}

render(h(App, null), document.getElementById("app"));
