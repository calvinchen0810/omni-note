import { h } from "https://esm.sh/preact@10.19.3";
import { useState } from "https://esm.sh/preact@10.19.3/hooks";

const PEN_COLORS   = ["#1a1a2e", "#e63946", "#2196f3", "#4caf50", "#9c27b0", "#ff9800"];
const HL_COLORS    = ["#ffd60a", "#7bf7a0", "#74c0fc", "#f783ac", "#a9e34b", "#ffa94d"];

function ToolBtn({ active, title, onClick, children, danger }) {
  return h("button", {
    title,
    onClick,
    class: ["tool-btn", active && "active", danger && "danger"].filter(Boolean).join(" "),
  }, children);
}

function Divider() {
  return h("div", { class: "tool-divider" });
}

export function Toolbar({ state, dispatch, onAddStickyNote, onUndo, onRedo }) {
  const [showEraserMenu, setShowEraserMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPalettePos, setColorPalettePos] = useState(null);

  const tool = state.currentTool;
  const canUndo = state.undoStack.length > 0;
  const canRedo = state.redoStack.length > 0;

  function setTool(t) {
    dispatch({ type: "SET_TOOL", tool: t });
    setShowEraserMenu(false);
    setShowColorPicker(false);
    setColorPalettePos(null);
  }

  function toggleColorPicker(e) {
    if (showColorPicker) {
      setShowColorPicker(false);
      setColorPalettePos(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const canvasRect = document.querySelector(".canvas-wrapper")?.getBoundingClientRect();
    const paletteHeight = 190;
    const top = Math.min(
      window.innerHeight - paletteHeight,
      Math.max(8, rect.top - 8)
    );
    const left = Math.max(rect.right + 12, (canvasRect?.left ?? rect.right) + 8);

    setColorPalettePos({ left, top });
    setShowColorPicker(true);
  }

  const activeColor = tool === "pen"
    ? state.penColor
    : tool === "highlighter"
      ? state.highlighterColor
      : null;

  // Size of the color swatch reflects current brush width (8–28px)
  const swatchSize = (() => {
    if (tool === "pen")         return Math.round(8  + (state.penWidth         - 1)  / 11 * 20);
    if (tool === "highlighter") return Math.round(12 + (state.highlighterWidth - 8)  / 32 * 16);
    return 26;
  })();

  return h("div", { class: "toolbar" },

    // ── Pen ───────────────────────────────────────────────────────────────────
    h(ToolBtn, { active: tool === "pen", title: "鋼筆 (P)", onClick: () => setTool("pen") },
      h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 2 },
        h("path", { d: "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" })
      )
    ),

    // ── Highlighter ───────────────────────────────────────────────────────────
    h(ToolBtn, { active: tool === "highlighter", title: "螢光筆 (H)", onClick: () => setTool("highlighter") },
      h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 2 },
        h("path", { d: "M12 20h9" }),
        h("path", { d: "M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" }),
        h("rect", { x: 3, y: 11, width: 18, height: 6, rx: 3, fill: state.highlighterColor, opacity: 0.35, stroke: "none" })
      )
    ),

    // ── Color Swatch ──────────────────────────────────────────────────────────
    activeColor && h("div", null,
      h("button", {
        class: "color-swatch-btn",
        title: "顏色",
        style: { "--swatch-dot-size": `${swatchSize}px` },
        onClick: (e) => toggleColorPicker(e),
      },
        h("span", {
          class: "color-swatch-dot",
          style: { background: activeColor },
        })
      ),
      showColorPicker && colorPalettePos && h("div", {
        class: "color-palette color-palette-overlay",
        style: { left: `${colorPalettePos.left}px`, top: `${colorPalettePos.top}px` },
      },
        (tool === "pen" ? PEN_COLORS : HL_COLORS).map((c) =>
          h("button", {
            key: c,
            class: ["color-dot", activeColor === c && "selected"].filter(Boolean).join(" "),
            style: { background: c },
            onClick: () => {
              dispatch({ type: tool === "pen" ? "SET_PEN_COLOR" : "SET_HL_COLOR", color: c });
              setShowColorPicker(false);
              setColorPalettePos(null);
            },
          })
        )
      )
    ),

    h(Divider),

    // ── Eraser (with mode dropdown) ───────────────────────────────────────────
    h("div", { style: { position: "relative" } },
      h("div", { style: { display: "flex", alignItems: "center" } },
        h(ToolBtn, {
          active: tool === "eraser",
          title: "橡皮擦 (E)",
          onClick: () => setTool("eraser"),
        },
          h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 2 },
            h("path", { d: "M20 20H7L3 16l9.586-9.586a2 2 0 0 1 2.828 0L20 11l-7 9" }),
            h("path", { d: "m6 11 7.5-7.5" })
          )
        ),
        h("button", {
          class: "eraser-mode-toggle",
          title: state.eraserMode === "precise" ? "切換: 逐點抹除（精確）" : "切換: 整筆刪除",
          onClick: () => {
            const next = state.eraserMode === "precise" ? "stroke" : "precise";
            dispatch({ type: "SET_ERASER_MODE", mode: next });
          },
        },
          state.eraserMode === "precise"
            ? h("span", { class: "mode-badge precise" }, "精")
            : h("span", { class: "mode-badge stroke" }, "筆")
        )
      )
    ),

    h(Divider),

    // ── Select ────────────────────────────────────────────────────────────────
    h(ToolBtn, { active: tool === "select", title: "套索選取 (S)", onClick: () => setTool("select") },
      h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 2 },
        h("path", { d: "M7 3C5 3 3 5 3 7v10c0 2 2 4 4 4h10c2 0 4-2 4-4V7c0-2-2-4-4-4H7z", "stroke-dasharray": "4 2" }),
        h("path", { d: "m9 15 3-3 3 3" }),
        h("path", { d: "M12 12v6" })
      )
    ),

    // ── Sticky ────────────────────────────────────────────────────────────────
    h(ToolBtn, { active: tool === "sticky", title: "新增便利貼 (N)", onClick: () => {
      setTool("sticky");
      onAddStickyNote?.();
    }},
      h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 2 },
        h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
        h("path", { d: "M14 2v6h6" }),
        h("line", { x1: 8, y1: 13, x2: 16, y2: 13 }),
        h("line", { x1: 8, y1: 17, x2: 12, y2: 17 })
      )
    ),

    h(Divider),

    // ── Undo / Redo ───────────────────────────────────────────────────────────
    h(ToolBtn, {
      title: "復原 (Ctrl+Z)",
      onClick: onUndo,
      active: false,
      danger: false,
    },
      h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: canUndo ? "currentColor" : "#ccc", "stroke-width": 2 },
        h("path", { d: "M3 7v6h6" }),
        h("path", { d: "M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" })
      )
    ),

    h(ToolBtn, {
      title: "重做 (Ctrl+Y)",
      onClick: onRedo,
      active: false,
    },
      h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: canRedo ? "currentColor" : "#ccc", "stroke-width": 2 },
        h("path", { d: "M21 7v6h-6" }),
        h("path", { d: "M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" })
      )
    ),

    // ── Width slider ──────────────────────────────────────────────────────────
    (tool === "pen" || tool === "highlighter" || tool === "eraser") && h(Divider),

    tool === "pen" && h("div", { class: "width-control" },
      h("span", { class: "width-label" }, "粗細"),
      h("div", { class: "width-slider-wrap" },
        h("div", { class: "width-triangle" }),
        h("input", {
          type: "range", min: 1, max: 12, value: state.penWidth,
          onInput: (e) => dispatch({ type: "SET_PEN_WIDTH", width: +e.target.value }),
        })
      )
    ),

    tool === "highlighter" && h("div", { class: "width-control" },
      h("span", { class: "width-label" }, "粗細"),
      h("div", { class: "width-slider-wrap" },
        h("div", { class: "width-triangle" }),
        h("input", {
          type: "range", min: 8, max: 40, value: state.highlighterWidth,
          onInput: (e) => dispatch({ type: "SET_HL_WIDTH", width: +e.target.value }),
        })
      )
    ),

    tool === "eraser" && h("div", { class: "width-control" },
      h("span", { class: "width-label" }, "大小"),
      h("div", { class: "width-slider-wrap" },
        h("div", { class: "width-triangle" }),
        h("input", {
          type: "range", min: 10, max: 80, value: state.eraserWidth,
          onInput: (e) => dispatch({ type: "SET_ERASER_WIDTH", width: +e.target.value }),
        })
      )
    ),
  );
}
