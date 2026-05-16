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

export function Toolbar({ state, dispatch, onAddStickyNote, onUndo, onRedo, pageType }) {
  const [showEraserMenu, setShowEraserMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPalettePos, setColorPalettePos] = useState(null);
  const [showWidthPicker, setShowWidthPicker] = useState(false);
  const [widthPickerPos, setWidthPickerPos] = useState(null);

  const tool = state.currentTool;
  const canUndo = state.undoStack.length > 0;
  const canRedo = state.redoStack.length > 0;

  function setTool(t) {
    dispatch({ type: "SET_TOOL", tool: t });
    setShowEraserMenu(false);
    setShowColorPicker(false);
    setColorPalettePos(null);
    setShowWidthPicker(false);
    setWidthPickerPos(null);
  }

  function toggleColorPicker(e) {
    if (showColorPicker) {
      setShowColorPicker(false);
      setColorPalettePos(null);
      return;
    }
    setShowWidthPicker(false);
    setWidthPickerPos(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 168));
    const top = rect.bottom + 8;
    setColorPalettePos({ left, top });
    setShowColorPicker(true);
  }

  function toggleWidthPicker(e) {
    if (showWidthPicker) {
      setShowWidthPicker(false);
      setWidthPickerPos(null);
      return;
    }
    setShowColorPicker(false);
    setColorPalettePos(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left - 20, window.innerWidth - 180));
    const top = rect.bottom + 8;
    setWidthPickerPos({ left, top });
    setShowWidthPicker(true);
  }

  const activeColor = tool === "pen"
    ? state.penColor
    : tool === "highlighter"
      ? state.highlighterColor
      : null;

  const activeWidth = tool === "pen"       ? state.penWidth
    : tool === "highlighter" ? state.highlighterWidth
    : tool === "eraser"      ? state.eraserWidth
    : null;

  const widthMin    = tool === "pen" ? 1  : tool === "highlighter" ? 8  : 10;
  const widthMax    = tool === "pen" ? 12 : tool === "highlighter" ? 40 : 80;
  const widthAction = tool === "pen" ? "SET_PEN_WIDTH"
    : tool === "highlighter" ? "SET_HL_WIDTH" : "SET_ERASER_WIDTH";
  const widthLabel  = tool === "eraser" ? "大小" : "粗細";

  // Size of the color swatch reflects current brush width (8–28px)
  const swatchSize = (() => {
    if (tool === "pen")         return Math.round(8  + (state.penWidth         - 1)  / 11 * 20);
    if (tool === "highlighter") return Math.round(12 + (state.highlighterWidth - 8)  / 32 * 16);
    return 26;
  })();

  // Line thickness preview height for width button (2–12px range capped)
  const previewH = tool === "pen"
    ? Math.round(2 + (state.penWidth - 1) / 11 * 10)
    : tool === "highlighter"
      ? Math.round(4 + (state.highlighterWidth - 8) / 32 * 8)
      : Math.round(3 + (state.eraserWidth - 10) / 70 * 9);

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

    // ── Color Swatch + Width button (pen / highlighter) ───────────────────────
    activeColor && h("div", { style: { display: "flex", alignItems: "center", gap: "4px" } },
      // Color swatch
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
      // Width button (next to color swatch)
      h("button", {
        class: ["width-swatch-btn", showWidthPicker && "active"].filter(Boolean).join(" "),
        title: widthLabel,
        onClick: (e) => toggleWidthPicker(e),
      },
        h("span", {
          class: "width-swatch-line",
          style: {
            height: `${previewH}px`,
            background: activeColor,
          },
        })
      ),

      // Color palette overlay
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
      ),

      // Width popover overlay
      showWidthPicker && widthPickerPos && h("div", {
        class: "width-popover-overlay",
        style: { left: `${widthPickerPos.left}px`, top: `${widthPickerPos.top}px` },
      },
        h("span", { class: "width-popover-label" }, widthLabel),
        h("div", { class: "width-slider-wrap" },
          h("div", { class: "width-triangle" }),
          h("input", {
            type: "range", min: widthMin, max: widthMax, value: activeWidth,
            onInput: (e) => dispatch({ type: widthAction, width: +e.target.value }),
          })
        ),
        h("span", { class: "width-popover-value" }, activeWidth)
      ),
    ),

    h(Divider),

    // ── Eraser (with mode dropdown + width button) ────────────────────────────
    h("div", { style: { position: "relative", display: "flex", alignItems: "center", gap: "2px" } },
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
      ),
      // Width button for eraser
      tool === "eraser" && h("button", {
        class: ["width-swatch-btn", showWidthPicker && "active"].filter(Boolean).join(" "),
        title: "橡皮擦大小",
        style: { marginLeft: "2px" },
        onClick: (e) => toggleWidthPicker(e),
      },
        h("span", {
          class: "width-swatch-line",
          style: { height: `${previewH}px`, background: "#9ca3af" },
        })
      ),
      // Width popover overlay for eraser
      tool === "eraser" && showWidthPicker && widthPickerPos && h("div", {
        class: "width-popover-overlay",
        style: { left: `${widthPickerPos.left}px`, top: `${widthPickerPos.top}px` },
      },
        h("span", { class: "width-popover-label" }, "大小"),
        h("div", { class: "width-slider-wrap" },
          h("div", { class: "width-triangle" }),
          h("input", {
            type: "range", min: widthMin, max: widthMax, value: activeWidth,
            onInput: (e) => dispatch({ type: widthAction, width: +e.target.value }),
          })
        ),
        h("span", { class: "width-popover-value" }, activeWidth)
      ),
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

    h(ToolBtn, { active: tool === "pan", title: "手掌拖動畫布", onClick: () => setTool("pan") },
      h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" },
        h("path", { d: "M7 11V5a1 1 0 0 1 2 0v5" }),
        h("path", { d: "M11 11V4a1 1 0 0 1 2 0v7" }),
        h("path", { d: "M15 11V6a1 1 0 0 1 2 0v7" }),
        h("path", { d: "M5 12.5a1.5 1.5 0 0 1 3 0V14" }),
        h("path", { d: "M17 11h1a2 2 0 0 1 2 2v2.5C20 19.09 17.09 22 13.5 22h-.56a6 6 0 0 1-4.24-1.76l-2.18-2.18A3.5 3.5 0 0 1 5.5 15.6V12.5" })
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

    // ── Mindmap tool ──────────────────────────────────────────────────────────
    h(Divider),
    h(ToolBtn, {
      active: tool === "mindmap",
      title: "心智圖工具",
      onClick: () => setTool("mindmap"),
    },
      h("svg", { viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor", "stroke-width": 2 },
        h("circle", { cx: 12, cy: 12, r: 3 }),
        h("circle", { cx: 3,  cy: 5,  r: 2 }),
        h("circle", { cx: 21, cy: 5,  r: 2 }),
        h("circle", { cx: 3,  cy: 19, r: 2 }),
        h("circle", { cx: 21, cy: 19, r: 2 }),
        h("line",   { x1: 9,  y1: 10, x2: 5,  y2: 7  }),
        h("line",   { x1: 15, y1: 10, x2: 19, y2: 7  }),
        h("line",   { x1: 9,  y1: 14, x2: 5,  y2: 17 }),
        h("line",   { x1: 15, y1: 14, x2: 19, y2: 17 })
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
  );
}
