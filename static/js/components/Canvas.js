import { h } from "https://esm.sh/preact@10.19.3";
import { useRef, useEffect, useCallback } from "https://esm.sh/preact@10.19.3/hooks";
import {
  renderAllStrokes,
  renderStroke,
  preciseErase,
  strokeErase,
  findStrokesInLasso,
  translateStrokes,
  drawLasso,
  drawEraserCursor,
  drawPenCursor,
  drawPageBackground,
  uid,
} from "../canvas-utils.js";

export function Canvas({ state, dispatch, onSave, pageWidth, pageHeight }) {
  const baseRef    = useRef(null);
  const overlayRef = useRef(null);
  const containerRef = useRef(null);

  // Mutable drawing session — not React state (too high-frequency)
  const sess = useRef({
    drawing: false,
    currentPts: [],
    erasing: false,
    lasso: false,
    lassoPath: [],
    dragging: false,
    dragStart: null,
    dragBaseStrokes: null,
    eraseTimer: null,
    pendingErasedStrokes: null,
  });

  // ── Resize ────────────────────────────────────────────────────────────────

  function resizeCanvases() {
    const c = containerRef.current;
    if (!c) return;
    const width = c.clientWidth;
    const height = c.clientHeight;
    for (const ref of [baseRef, overlayRef]) {
      if (ref.current && (ref.current.width !== width || ref.current.height !== height)) {
        ref.current.width  = width;
        ref.current.height = height;
      }
    }
    redrawBase();
  }

  useEffect(() => {
    resizeCanvases();
    const ro = new ResizeObserver(resizeCanvases);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Redraw base canvas ────────────────────────────────────────────────────

  function redrawBase(overrideStrokes) {
    const canvas = baseRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPageBackground(ctx, canvas.width, canvas.height);
    const page = state.pages[state.currentPageIndex];
    renderAllStrokes(ctx, overrideStrokes ?? page?.strokes ?? []);
  }

  useEffect(() => { redrawBase(); }, [state.pages, state.currentPageIndex]);

  // ── Redraw overlay when selection changes ─────────────────────────────────

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.lassoPath.length > 1) {
      const page = state.pages[state.currentPageIndex];
      drawLasso(ctx, state.lassoPath, new Set(state.selectedStrokeIds), page?.strokes ?? []);
    }
  }, [state.lassoPath, state.selectedStrokeIds]);

  // ── Pointer position helper ───────────────────────────────────────────────

  function pos(e) {
    const canvas = overlayRef.current;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? canvas.width / rect.width : 1;
    const sy = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  // ── Pen / Highlighter ─────────────────────────────────────────────────────

  function penDown(p) {
    sess.current.drawing = true;
    sess.current.currentPts = [[p.x, p.y, p.pressure]];
  }

  function drawPenHoverCursor(p) {
    const hl = state.currentTool === "highlighter";
    const radius = hl ? state.highlighterWidth / 2 : state.penWidth / 2;
    const color  = hl ? state.highlighterColor : state.penColor;
    const octx = overlayRef.current.getContext("2d");
    octx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    drawPenCursor(octx, p.x, p.y, radius, color);
  }

  function penMove(p) {
    if (!sess.current.drawing) {
      drawPenHoverCursor(p);
      return;
    }
    sess.current.currentPts.push([p.x, p.y, p.pressure]);

    const ctx = overlayRef.current.getContext("2d");
    ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    renderStroke(ctx, makeStroke(state, sess.current.currentPts));
    // redraw cursor on top of live stroke
    const hl = state.currentTool === "highlighter";
    drawPenCursor(ctx, p.x, p.y, hl ? state.highlighterWidth / 2 : state.penWidth / 2, hl ? state.highlighterColor : state.penColor);
  }

  function penUp() {
    if (!sess.current.drawing) return;
    sess.current.drawing = false;
    const pts = sess.current.currentPts;
    if (!pts.length) return;

    const stroke = makeStroke(state, pts);

    // Paint the completed stroke directly on the base canvas BEFORE clearing
    // the overlay. This prevents the one-frame flash that would otherwise
    // appear between the overlay clear and the Preact re-render redraw.
    const bctx = baseRef.current?.getContext("2d");
    if (bctx) renderStroke(bctx, stroke);

    overlayRef.current.getContext("2d")
      .clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);

    dispatch({ type: "ADD_STROKE", stroke });
    sess.current.currentPts = [];
    onSave?.();
  }

  // ── Eraser ────────────────────────────────────────────────────────────────

  function eraserMove(p) {
    const octx = overlayRef.current.getContext("2d");
    octx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    drawEraserCursor(octx, p.x, p.y, state.eraserWidth / 2);

    if (!sess.current.erasing) return;

    const page = state.pages[state.currentPageIndex];
    if (!page) return;

    const src = sess.current.pendingErasedStrokes ?? page.strokes ?? [];
    const result = state.eraserMode === "precise"
      ? preciseErase(src, p.x, p.y, state.eraserWidth / 2)
      : strokeErase(src, p.x, p.y, state.eraserWidth / 2);

    if (result.changed) {
      sess.current.pendingErasedStrokes = result.strokes;
      // Optimistic visual update without touching Redux
      redrawBase(result.strokes);

      // Debounce the Redux dispatch so rapid erasing is a single undo entry
      clearTimeout(sess.current.eraseTimer);
      sess.current.eraseTimer = setTimeout(() => {
        dispatch({ type: "SET_STROKES", strokes: sess.current.pendingErasedStrokes, pushUndo: true });
        sess.current.pendingErasedStrokes = null;
        onSave?.();
      }, 500);
    }
  }

  function eraserLeave() {
    const ctx = overlayRef.current?.getContext("2d");
    ctx?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
  }

  // ── Lasso select ──────────────────────────────────────────────────────────

  function lassoDown(p) {
    if (state.selectedStrokeIds.length > 0) {
      // Start drag of existing selection
      sess.current.dragging = true;
      sess.current.dragStart = p;
      sess.current.dragBaseStrokes = state.pages[state.currentPageIndex]?.strokes ?? [];
      return;
    }
    sess.current.lasso = true;
    sess.current.lassoPath = [[p.x, p.y]];
    dispatch({ type: "CLEAR_SELECTION" });
  }

  function lassoMove(p) {
    const octx = overlayRef.current.getContext("2d");
    octx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);

    if (sess.current.dragging) {
      const { x: sx, y: sy } = sess.current.dragStart;
      const moved = translateStrokes(
        sess.current.dragBaseStrokes,
        state.selectedStrokeIds,
        p.x - sx, p.y - sy
      );
      redrawBase(moved);
      return;
    }

    if (!sess.current.lasso) return;
    sess.current.lassoPath.push([p.x, p.y]);
    drawLasso(octx, sess.current.lassoPath, new Set(), []);
  }

  function lassoUp(p) {
    if (sess.current.dragging) {
      const { x: sx, y: sy } = sess.current.dragStart;
      const moved = translateStrokes(
        sess.current.dragBaseStrokes,
        state.selectedStrokeIds,
        p.x - sx, p.y - sy
      );
      dispatch({ type: "MOVE_SELECTED_STROKES", strokes: moved });
      sess.current.dragging = false;
      onSave?.();
      return;
    }

    if (!sess.current.lasso) return;
    sess.current.lasso = false;

    const path = sess.current.lassoPath;
    sess.current.lassoPath = [];

    const page = state.pages[state.currentPageIndex];
    const ids = findStrokesInLasso(page?.strokes ?? [], path);
    dispatch({ type: "SET_LASSO_PATH", path });
    dispatch({ type: "SET_SELECTED_STROKES", ids });
  }

  // ── Pointer event dispatch ────────────────────────────────────────────────

  const onPointerDown = useCallback((e) => {
    if (e.pointerType === "touch" && !e.isPrimary) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pos(e);
    const tool = state.currentTool;
    if (tool === "pen" || tool === "highlighter") penDown(p);
    else if (tool === "eraser") { sess.current.erasing = true; eraserMove(p); }
    else if (tool === "select") lassoDown(p);
  }, [state]);

  const onPointerMove = useCallback((e) => {
    if (e.pointerType === "touch" && !e.isPrimary) return;
    const p = pos(e);
    const tool = state.currentTool;
    if (tool === "pen" || tool === "highlighter") penMove(p);
    else if (tool === "eraser") eraserMove(p);
    else if (tool === "select") lassoMove(p);
  }, [state]);

  const onPointerUp = useCallback((e) => {
    if (e.pointerType === "touch" && !e.isPrimary) return;
    const p = pos(e);
    const tool = state.currentTool;
    if (tool === "pen" || tool === "highlighter") penUp();
    else if (tool === "eraser") { sess.current.erasing = false; eraserLeave(); }
    else if (tool === "select") lassoUp(p);
  }, [state]);

  // ── Render ────────────────────────────────────────────────────────────────

  const cursor = { pen: "none", highlighter: "none", eraser: "none",
                   select: "default", sticky: "cell" }[state.currentTool] ?? "crosshair";

  return h("div", {
    ref: containerRef,
    style: {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      width: `${pageWidth}px`,
      height: `${pageHeight}px`,
    },
  },
    h("canvas", { ref: baseRef, style: { position: "absolute", inset: 0 } }),
    h("canvas", {
      ref: overlayRef,
      style: { position: "absolute", inset: 0, cursor, touchAction: "none" },
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onPointerLeave: () => {
        if (state.currentTool === "eraser") eraserLeave();
        else if (state.currentTool === "pen" || state.currentTool === "highlighter") {
          overlayRef.current?.getContext("2d")
            ?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
        }
      },
    })
  );
}

function makeStroke(state, points) {
  const hl = state.currentTool === "highlighter";
  return {
    id: uid(),
    tool: hl ? "highlighter" : "pen",
    color: hl ? state.highlighterColor : state.penColor,
    width: hl ? state.highlighterWidth : state.penWidth,
    points,
  };
}
