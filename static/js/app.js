import { h, render } from "https://esm.sh/preact@10.19.3";
import { useReducer, useEffect, useCallback, useRef } from "https://esm.sh/preact@10.19.3/hooks";

import { initialState, reducer } from "./store.js";
import { api } from "./api.js";
import { uid } from "./canvas-utils.js";

import { NotebookList } from "./components/NotebookList.js";
import { Canvas }       from "./components/Canvas.js";
import { Toolbar }      from "./components/Toolbar.js";
import { PageTabs }     from "./components/PageTabs.js";
import { StickyNote }   from "./components/StickyNote.js";

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [notebooks, setNotebooks]   = useReducer((s, a) => a, []);
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
        color: "#ffd60a",
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

  // ── Back to list ──────────────────────────────────────────────────────────

  async function handleBack() {
    await saveCurrentPage();
    dispatch({ type: "BACK_TO_LIST" });
    await loadNotebooks();
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
    // ── Top bar ───────────────────────────────────────────────────────────────
    h("div", { class: "top-bar" },
      h("button", { class: "btn-back", onClick: handleBack }, "← 返回"),
      h("div", { class: "notebook-title" }, state.notebook?.title ?? ""),
      h("div", { class: "save-indicator" },
        state.isDirty
          ? h("span", { class: "saving" }, "未儲存")
          : h("span", { class: "saved" }, "✓ 已儲存")
      )
    ),

    // ── Main area ─────────────────────────────────────────────────────────────
    h("div", { class: "editor-main" },

      // Left toolbar
      h(Toolbar, {
        state,
        dispatch,
        onAddStickyNote: handleAddStickyNote,
        onUndo: handleUndo,
        onRedo: handleRedo,
      }),

      // Canvas + sticky notes layer
      h("div", { class: "canvas-wrapper" },
        h(Canvas, { state, dispatch, onSave: scheduleSave }),

        // Sticky notes as DOM overlay
        currentPage && (currentPage.sticky_notes ?? []).map((note) =>
          h(StickyNote, {
            key:      note.id,
            note,
            onUpdate: (patch) => handleUpdateStickyNote(note.id, patch),
            onDelete: () => handleDeleteStickyNote(note.id),
          })
        )
      )
    ),

    // ── Bottom page tabs ──────────────────────────────────────────────────────
    h(PageTabs, {
      state,
      dispatch,
      onAddPage:    handleAddPage,
      onDeletePage: handleDeletePage,
    })
  );
}

render(h(App, null), document.getElementById("app"));
