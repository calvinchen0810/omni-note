import { h } from "https://esm.sh/preact@10.19.3";
import { useState, useRef, useEffect, useCallback } from "https://esm.sh/preact@10.19.3/hooks";
import {
  renderStroke,
  preciseErase,
  strokeErase,
  drawPenCursor,
  drawEraserCursor,
  uid,
} from "../canvas-utils.js";

const DEFAULT_STICKY_COLOR = "#fff6bf";
const BG_COLORS = [
  "#fff6bf", // light yellow (default)
  "#ffe5ec", // light pink
  "#ffe8cc", // light peach
  "#e3fafc", // light cyan
  "#e6fcf5", // light mint
  "#e5dbff", // light lavender
  "#f1f3f5", // light gray
];
const HANDLE_H = 22;

function parseContent(content) {
  try {
    const obj = JSON.parse(content || "{}");
    const raw = Array.isArray(obj.strokes) ? obj.strokes : [];
    const strokes = raw
      .map((s) => normalizeStroke(s))
      .filter(Boolean);
    return {
      strokes,
      opacity: typeof obj.opacity === "number" ? obj.opacity : 1.0,
    };
  } catch {
    return { strokes: [], opacity: 1.0 };
  }
}

function serializeContent(strokes, opacity) {
  return JSON.stringify({ strokes, opacity });
}

function normalizeStroke(s) {
  if (!s) return null;
  if (Array.isArray(s.points)) {
    return {
      id: s.id || uid(),
      tool: s.tool || "pen",
      color: s.color || "#1a1a2e",
      width: typeof s.width === "number" ? s.width : 2,
      points: s.points,
    };
  }
  if (Array.isArray(s.pts)) {
    return {
      id: s.id || uid(),
      tool: s.tool || "pen",
      color: s.color || "#1a1a2e",
      width: typeof s.width === "number" ? s.width : 2,
      points: s.pts.map((p) => [p[0], p[1], p[2] ?? 0.5]),
    };
  }
  return null;
}

function redrawBase(canvas, strokes, bgColor) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = bgColor || DEFAULT_STICKY_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) renderStroke(ctx, stroke);
}

function getPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width > 0 ? canvas.width / rect.width : 1;
  const sy = rect.height > 0 ? canvas.height / rect.height : 1;
  return {
    x: (e.clientX - rect.left) * sx,
    y: (e.clientY - rect.top) * sy,
    pressure: e.pressure > 0 ? e.pressure : 0.5,
  };
}

export function StickyNote({
  note,
  onUpdate,
  onDelete,
  zoom = 1,
  interactive = true,
  tool = "pen",
  penColor = "#1a1a2e",
  penWidth = 3,
  highlighterColor = "#ffd60a",
  highlighterWidth = 18,
  eraserWidth = 28,
  eraserMode = "stroke",
}) {
  const initParsed = parseContent(note.content);
  const [localStrokes, setLocalStrokes] = useState(initParsed.strokes);
  const [opacity, setOpacity] = useState(initParsed.opacity);
  const [showMenu, setShowMenu] = useState(false);

  const baseRef = useRef(null);
  const overlayRef = useRef(null);
  const strokesRef = useRef(localStrokes);
  const sessRef = useRef({ drawing: false, erasing: false, currentStroke: null, erasedChanged: false });

  useEffect(() => {
    strokesRef.current = localStrokes;
  }, [localStrokes]);

  useEffect(() => {
    const base = baseRef.current;
    const overlay = overlayRef.current;
    if (!base || !overlay) return;

    const cw = note.width;
    const ch = note.height - HANDLE_H;
    if (base.width !== cw || base.height !== ch) {
      base.width = cw;
      base.height = ch;
    }
    if (overlay.width !== cw || overlay.height !== ch) {
      overlay.width = cw;
      overlay.height = ch;
    }

    redrawBase(base, localStrokes, note.color);
    overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
  }, [note.width, note.height, note.color, localStrokes]);

  function brushSpec() {
    if (tool === "highlighter") {
      return { tool: "highlighter", color: highlighterColor, width: highlighterWidth };
    }
    return { tool: "pen", color: penColor, width: penWidth };
  }

  function renderHoverCursor(p) {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (tool === "eraser") {
      drawEraserCursor(ctx, p.x, p.y, eraserWidth / 2);
      return;
    }

    if (tool === "pen" || tool === "highlighter") {
      const spec = brushSpec();
      drawPenCursor(ctx, p.x, p.y, spec.width / 2, spec.color);
    }
  }

  const onDrawPointerDown = useCallback((e) => {
    if (!interactive) return;

    const overlay = overlayRef.current;
    overlay.setPointerCapture(e.pointerId);
    const p = getPos(overlay, e);

    if (tool === "eraser") {
      sessRef.current.erasing = true;
      sessRef.current.erasedChanged = false;
      renderHoverCursor(p);
      return;
    }

    if (tool !== "pen" && tool !== "highlighter") return;

    const spec = brushSpec();
    sessRef.current.drawing = true;
    sessRef.current.currentStroke = {
      id: uid(),
      tool: spec.tool,
      color: spec.color,
      width: spec.width,
      points: [[p.x, p.y, p.pressure]],
    };
    renderHoverCursor(p);
  }, [interactive, tool, penColor, penWidth, highlighterColor, highlighterWidth, eraserWidth]);

  const onDrawPointerMove = useCallback((e) => {
    const overlay = overlayRef.current;
    const base = baseRef.current;
    if (!overlay || !base) return;
    const p = getPos(overlay, e);

    if (sessRef.current.erasing && tool === "eraser") {
      const result = eraserMode === "precise"
        ? preciseErase(strokesRef.current, p.x, p.y, eraserWidth / 2)
        : strokeErase(strokesRef.current, p.x, p.y, eraserWidth / 2);

      if (result.changed) {
        sessRef.current.erasedChanged = true;
        strokesRef.current = result.strokes;
        setLocalStrokes(result.strokes);
        redrawBase(base, result.strokes, note.color);
      }
      renderHoverCursor(p);
      return;
    }

    if (sessRef.current.drawing && sessRef.current.currentStroke) {
      sessRef.current.currentStroke.points.push([p.x, p.y, p.pressure]);
      const ctx = overlay.getContext("2d");
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      renderStroke(ctx, sessRef.current.currentStroke);
      const spec = brushSpec();
      drawPenCursor(ctx, p.x, p.y, spec.width / 2, spec.color);
      return;
    }

    if (tool === "pen" || tool === "highlighter" || tool === "eraser") {
      renderHoverCursor(p);
    }
  }, [tool, eraserMode, eraserWidth, note.color, penColor, penWidth, highlighterColor, highlighterWidth]);

  const onDrawPointerUp = useCallback(() => {
    const overlay = overlayRef.current;
    const base = baseRef.current;
    if (!overlay || !base) return;

    if (sessRef.current.erasing) {
      sessRef.current.erasing = false;
      if (sessRef.current.erasedChanged) {
        onUpdate({ content: serializeContent(strokesRef.current, opacity) });
      }
      sessRef.current.erasedChanged = false;
      overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
      return;
    }

    if (sessRef.current.drawing && sessRef.current.currentStroke) {
      sessRef.current.drawing = false;
      const stroke = sessRef.current.currentStroke;
      sessRef.current.currentStroke = null;

      if (stroke.points.length > 0) {
        const next = [...strokesRef.current, stroke];
        strokesRef.current = next;
        setLocalStrokes(next);
        redrawBase(base, next, note.color);
        onUpdate({ content: serializeContent(next, opacity) });
      }

      overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
    }
  }, [onUpdate, opacity, note.color]);

  const clearCanvas = useCallback(() => {
    setLocalStrokes([]);
    onUpdate({ content: serializeContent([], opacity) });
    setShowMenu(false);
  }, [opacity, onUpdate]);

  const toggleOpacity = useCallback(() => {
    const next = opacity >= 0.9 ? 0.5 : 1.0;
    setOpacity(next);
    onUpdate({ content: serializeContent(localStrokes, next) });
    setShowMenu(false);
  }, [opacity, localStrokes, onUpdate]);

  const onHandlePointerDown = useCallback((e) => {
    if (e.target.tagName === "BUTTON") return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    el.setPointerCapture(pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const baseX = note.x;
    const baseY = note.y;

    function move(ev) {
      if (ev.pointerId !== pointerId) return;
      onUpdate({
        x: baseX + (ev.clientX - startX) / zoom,
        y: baseY + (ev.clientY - startY) / zoom,
      });
    }

    function up(ev) {
      if (ev.pointerId !== pointerId) return;
      cleanup();
    }

    function lost(ev) {
      if (ev.pointerId !== pointerId) return;
      cleanup();
    }

    function cleanup() {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("lostpointercapture", lost);
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    }

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", lost);
  }, [note.x, note.y, onUpdate, zoom]);

  const onResizePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    el.setPointerCapture(pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = note.width;
    const startH = note.height;

    function move(ev) {
      if (ev.pointerId !== pointerId) return;
      onUpdate({
        width: Math.max(120, startW + (ev.clientX - startX) / zoom),
        height: Math.max(80, startH + (ev.clientY - startY) / zoom),
      });
    }

    function up(ev) {
      if (ev.pointerId !== pointerId) return;
      cleanup();
    }

    function lost(ev) {
      if (ev.pointerId !== pointerId) return;
      cleanup();
    }

    function cleanup() {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("lostpointercapture", lost);
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    }

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", lost);
  }, [note.width, note.height, onUpdate, zoom]);

  const stickyCursor = (tool === "pen" || tool === "highlighter" || tool === "eraser") ? "none" : "default";

  return h("div", {
    class: "sticky-note",
    style: {
      left: `${note.x}px`,
      top: `${note.y}px`,
      width: `${note.width}px`,
      height: `${note.height}px`,
      opacity,
      background: note.color || DEFAULT_STICKY_COLOR,
      pointerEvents: interactive ? "auto" : "none",
    },
  },
    h("div", {
      class: "sticky-handle",
      onPointerDown: onHandlePointerDown,
    },
      h("div", { class: "sticky-dots" }, "⠿"),
      h("div", { style: { position: "relative" } },
        h("button", {
          class: "sticky-menu-btn",
          onClick: () => setShowMenu(!showMenu),
          title: "Options",
        }, "⋮"),
        showMenu && h("div", { class: "sticky-menu" },
          h("div", { class: "sticky-menu-label" }, "Background color"),
          h("div", { class: "sticky-colors" },
            BG_COLORS.map((c) =>
              h("button", {
                key: c,
                class: ["color-dot", (note.color || DEFAULT_STICKY_COLOR) === c && "selected"].filter(Boolean).join(" "),
                style: { background: c },
                onClick: () => { onUpdate({ color: c }); setShowMenu(false); },
              })
            )
          ),
          h("button", { class: "sticky-action-btn", onClick: toggleOpacity }, opacity >= 0.9 ? "🔲 Semi-transparent" : "🔳 Opaque"),
          h("button", { class: "sticky-action-btn", onClick: clearCanvas }, "🧹 Clear canvas"),
          h("button", {
            class: "sticky-delete-btn",
            onClick: () => { setShowMenu(false); onDelete(); },
          }, "🗑 Delete note")
        )
      )
    ),

    h("div", { class: "sticky-canvas-wrap" },
      h("canvas", {
        ref: baseRef,
        class: "sticky-canvas sticky-canvas-base",
      }),
      h("canvas", {
        ref: overlayRef,
        class: "sticky-canvas sticky-canvas-overlay",
        style: { cursor: stickyCursor },
        onPointerDown: onDrawPointerDown,
        onPointerMove: onDrawPointerMove,
        onPointerUp: onDrawPointerUp,
        onPointerCancel: onDrawPointerUp,
        onPointerLeave: () => {
          const o = overlayRef.current;
          if (o) o.getContext("2d").clearRect(0, 0, o.width, o.height);
        },
      })
    ),

    h("div", {
      class: "sticky-resize",
      onPointerDown: onResizePointerDown,
    }, "⇲")
  );
}
