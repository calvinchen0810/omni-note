export const initialState = {
  view: "list",           // "list" | "editor"
  notebook: null,
  pages: [],
  currentPageIndex: 0,

  currentTool: "pen",     // "pen" | "highlighter" | "eraser" | "select" | "pan" | "sticky"
  eraserMode: "precise",  // "precise" | "stroke"
  penColor: "#1a1a2e",
  penWidth: 3,
  highlighterColor: "#ffd60a",
  highlighterWidth: 18,
  eraserWidth: 28,

  lassoPath: [],
  selectedStrokeIds: [],

  undoStack: [],
  redoStack: [],
  isDirty: false,

  // Cloud project currently open: { id, name, password, updatedAt } | null
  cloudProject: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentPage(state) {
  return state.pages[state.currentPageIndex] ?? null;
}

function snapshotPage(state) {
  const page = currentPage(state);
  if (!page) return null;
  return {
    strokes: page.strokes,
    sticky_notes: page.sticky_notes ?? [],
    mindmap: page.mindmap ?? { nodes: [], connections: [] },
  };
}

function withUndo(state) {
  const snap = snapshotPage(state);
  if (!snap) return state;
  return {
    ...state,
    undoStack: [...state.undoStack, snap],
    redoStack: [],
    isDirty: true,
  };
}

function patchCurrentPage(state, patch) {
  return {
    ...state,
    pages: state.pages.map((p, i) =>
      i === state.currentPageIndex ? { ...p, ...patch } : p
    ),
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

export function reducer(state, action) {
  switch (action.type) {

    case "OPEN_EDITOR":
      return {
        ...initialState,
        view: "editor",
        notebook: action.notebook,
        pages: action.pages,
      };

    case "BACK_TO_LIST":
      return { ...state, view: "list", notebook: null, pages: [], cloudProject: null };

    case "SET_CLOUD_PROJECT":
      return { ...state, cloudProject: action.project };

    case "OPEN_CLOUD_EDITOR":
      return {
        ...initialState,
        view: "editor",
        notebook: { id: null, title: action.name },
        pages: action.pages,
        cloudProject: action.cloudProject,
        isDirty: false,
      };

    case "UPDATE_NOTEBOOK_TITLE":
      return { ...state, notebook: { ...state.notebook, title: action.title } };

    // ── Pages ─────────────────────────────────────────────────────────────────

    case "SET_PAGE_INDEX": {
      const targetPage = state.pages[action.index];
      const keepTool = targetPage?.page_type === "mindmap" ? "mindmap"
        : state.currentTool === "mindmap" ? "pen"
        : state.currentTool;
      return {
        ...state,
        currentPageIndex: action.index,
        currentTool: keepTool,
        lassoPath: [],
        selectedStrokeIds: [],
        undoStack: [],
        redoStack: [],
      };
    }

    case "ADD_PAGE":
      return {
        ...state,
        pages: [...state.pages, action.page],
        currentPageIndex: state.pages.length,
        undoStack: [],
        redoStack: [],
      };

    case "DELETE_PAGE": {
      const pages = state.pages.filter((p) => p.id !== action.pageId);
      return {
        ...state,
        pages,
        currentPageIndex: Math.min(state.currentPageIndex, Math.max(0, pages.length - 1)),
        undoStack: [],
        redoStack: [],
      };
    }

    case "REPLACE_PAGE":
      return {
        ...state,
        pages: state.pages.map((p) => p.id === action.tempId ? action.page : p),
      };

    // ── Tools ─────────────────────────────────────────────────────────────────

    case "SET_TOOL":
      return { ...state, currentTool: action.tool, lassoPath: [], selectedStrokeIds: [] };

    case "SET_ERASER_MODE":
      return { ...state, eraserMode: action.mode };

    case "SET_PEN_COLOR":    return { ...state, penColor: action.color };
    case "SET_PEN_WIDTH":    return { ...state, penWidth: action.width };
    case "SET_HL_COLOR":     return { ...state, highlighterColor: action.color };
    case "SET_HL_WIDTH":     return { ...state, highlighterWidth: action.width };
    case "SET_ERASER_WIDTH": return { ...state, eraserWidth: action.width };

    // ── Strokes ───────────────────────────────────────────────────────────────

    case "ADD_STROKE": {
      const s0 = withUndo(state);
      const page = currentPage(s0);
      if (!page) return state;
      return patchCurrentPage(s0, { strokes: [...page.strokes, action.stroke] });
    }

    case "SET_STROKES": {
      const s0 = action.pushUndo ? withUndo(state) : { ...state, isDirty: true };
      return patchCurrentPage(s0, { strokes: action.strokes });
    }

    // ── Selection ─────────────────────────────────────────────────────────────

    case "SET_LASSO_PATH":      return { ...state, lassoPath: action.path };
    case "SET_SELECTED_STROKES": return { ...state, selectedStrokeIds: action.ids };
    case "CLEAR_SELECTION":     return { ...state, lassoPath: [], selectedStrokeIds: [] };

    case "MOVE_SELECTED_STROKES": {
      const s0 = withUndo(state);
      return patchCurrentPage(s0, { strokes: action.strokes });
    }

    // ── Sticky notes ──────────────────────────────────────────────────────────

    case "ADD_STICKY_NOTE": {
      const s0 = withUndo(state);
      const page = currentPage(s0);
      if (!page) return state;
      return patchCurrentPage(s0, {
        sticky_notes: [...(page.sticky_notes ?? []), action.note],
      });
    }

    case "UPDATE_STICKY_NOTE": {
      const page = currentPage(state);
      if (!page) return state;
      return {
        ...patchCurrentPage(state, {
          sticky_notes: (page.sticky_notes ?? []).map((n) =>
            n.id === action.note.id ? { ...n, ...action.note } : n
          ),
        }),
        isDirty: true,
      };
    }

    case "REMOVE_STICKY_NOTE": {
      const s0 = withUndo(state);
      const page = currentPage(s0);
      if (!page) return state;
      return patchCurrentPage(s0, {
        sticky_notes: (page.sticky_notes ?? []).filter((n) => n.id !== action.id),
      });
    }

    // ── Undo / Redo ───────────────────────────────────────────────────────────

    case "UNDO": {
      if (!state.undoStack.length) return state;
      const page = currentPage(state);
      const prev = state.undoStack[state.undoStack.length - 1];
      const redo = { strokes: page?.strokes ?? [], sticky_notes: page?.sticky_notes ?? [] };
      return patchCurrentPage(
        {
          ...state,
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, redo],
          isDirty: true,
        },
        prev
      );
    }

    case "REDO": {
      if (!state.redoStack.length) return state;
      const page = currentPage(state);
      const next = state.redoStack[state.redoStack.length - 1];
      const undo = { strokes: page?.strokes ?? [], sticky_notes: page?.sticky_notes ?? [] };
      return patchCurrentPage(
        {
          ...state,
          redoStack: state.redoStack.slice(0, -1),
          undoStack: [...state.undoStack, undo],
          isDirty: true,
        },
        next
      );
    }

    case "UPDATE_MINDMAP": {
      const s0 = action.pushUndo ? withUndo(state) : { ...state, isDirty: true };
      return patchCurrentPage(s0, { mindmap: action.mindmap });
    }

    case "UPDATE_PAGE_BACKGROUND":
      return patchCurrentPage(state, { background: action.background });

    case "MARK_SAVED":
      return { ...state, isDirty: false };

    default:
      return state;
  }
}
