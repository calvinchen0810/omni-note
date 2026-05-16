import { h } from "https://esm.sh/preact@10.19.3";
import { useRef, useEffect, useState, useCallback } from "https://esm.sh/preact@10.19.3/hooks";
import {
  renderAllStrokes, renderStroke,
  preciseErase, strokeErase,
  findStrokesInLasso, translateStrokes,
  drawLasso, drawEraserCursor, drawPenCursor,
  drawPageBackground, uid,
} from "../canvas-utils.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_W = 140;
const NODE_H = 50;
const CTRL   = 80; // bezier control handle length

export const NODE_COLORS = {
  white:  { bg: "#ffffff", border: "#d1d5db", text: "#1a1a2e" },
  blue:   { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  purple: { bg: "#ede9fe", border: "#8b5cf6", text: "#5b21b6" },
  red:    { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  green:  { bg: "#d1fae5", border: "#10b981", text: "#065f46" },
  orange: { bg: "#ffedd5", border: "#f97316", text: "#9a3412" },
};
const COLOR_KEYS = Object.keys(NODE_COLORS);

// ── Geometry helpers ──────────────────────────────────────────────────────────

function portPos(node, port) {
  const w = node.width  ?? NODE_W;
  const h = node.height ?? NODE_H;
  return {
    top:    { x: node.x + w / 2, y: node.y },
    right:  { x: node.x + w,     y: node.y + h / 2 },
    bottom: { x: node.x + w / 2, y: node.y + h },
    left:   { x: node.x,         y: node.y + h / 2 },
  }[port] ?? { x: node.x + w / 2, y: node.y + h / 2 };
}

const PORT_DIRS = { top: [0,-CTRL], right: [CTRL,0], bottom: [0,CTRL], left: [-CTRL,0] };

function bezierD(src, tgt, sp, tp) {
  const [sdx, sdy] = PORT_DIRS[sp] ?? [0, 0];
  const [tdx, tdy] = PORT_DIRS[tp] ?? [0, 0];
  return `M ${src.x} ${src.y} C ${src.x+sdx} ${src.y+sdy} ${tgt.x+tdx} ${tgt.y+tdy} ${tgt.x} ${tgt.y}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MindMapCanvas({ state, dispatch, onSave, pageWidth, pageHeight }) {
  const bgRef        = useRef(null);
  const strokeRef    = useRef(null);
  const overlayRef   = useRef(null);
  const containerRef = useRef(null);
  const bgImageRef   = useRef(null);
  const nodeElRefs   = useRef({});

  // drawing session (mirrors Canvas.js sess)
  const sess = useRef({
    drawing: false, currentPts: [],
    erasing: false, lasso: false, lassoPath: [],
    dragging: false, dragStart: null, dragBaseStrokes: null,
    eraseTimer: null, pendingErasedStrokes: null,
  });

  // mindmap drag/connect session
  const mmSess = useRef({ draggingId: null, dragOffset: { x: 0, y: 0 } });

  const [editingId,    setEditingId]    = useState(null);
  const [editText,     setEditText]     = useState("");
  const [selectedId,   setSelectedId]   = useState(null);
  const [connecting,   setConnecting]   = useState(null);  // { nodeId, port, x, y }
  const [tempCursor,   setTempCursor]   = useState(null);  // { x, y }
  const [mmDragState,  setMmDragState]  = useState(null);  // { id, x, y }
  const [showAddPage,  setShowAddPage]  = useState(false); // unused here, kept for symmetry

  const page    = state.pages[state.currentPageIndex];
  const mindmap = page?.mindmap ?? { nodes: [], connections: [] };
  const nodes   = mindmap.nodes       ?? [];
  const conns   = mindmap.connections ?? [];

  // ── Update helpers ──────────────────────────────────────────────────────────

  function updateMM(newMM, pushUndo = false) {
    dispatch({ type: "UPDATE_MINDMAP", mindmap: newMM, pushUndo });
    onSave?.();
  }

  // ── Resize ──────────────────────────────────────────────────────────────────

  function resizeCanvases() {
    const c = containerRef.current;
    if (!c) return;
    const w = c.clientWidth, h = c.clientHeight;
    for (const ref of [bgRef, strokeRef, overlayRef]) {
      if (ref.current && (ref.current.width !== w || ref.current.height !== h)) {
        ref.current.width = w;
        ref.current.height = h;
      }
    }
    redrawBg();
    redrawStrokes();
  }

  useEffect(() => {
    resizeCanvases();
    const ro = new ResizeObserver(resizeCanvases);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Background image ────────────────────────────────────────────────────────

  const bg    = page?.background ?? { type: "blank" };
  const bgKey = JSON.stringify(bg);

  useEffect(() => {
    if (bg.type !== "image") { bgImageRef.current = null; redrawBg(); return; }
    const img = new Image();
    img.onload  = () => { bgImageRef.current = img;   redrawBg(); };
    img.onerror = () => { bgImageRef.current = null;  redrawBg(); };
    img.src = `/backgrounds/${page.id}?t=${bg.ts ?? 0}`;
  }, [bgKey, state.currentPageIndex]);

  // ── Redraw ──────────────────────────────────────────────────────────────────

  function redrawBg() {
    const c = bgRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    drawPageBackground(ctx, c.width, c.height, bg, bgImageRef.current);
  }

  function redrawStrokes(overrideStrokes) {
    const c = strokeRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    renderAllStrokes(ctx, overrideStrokes ?? page?.strokes ?? []);
  }

  useEffect(() => { redrawBg(); },      [state.pages, state.currentPageIndex]);
  useEffect(() => { redrawStrokes(); }, [state.pages, state.currentPageIndex]);

  // ── Lasso overlay ────────────────────────────────────────────────────────────

  useEffect(() => {
    const c = overlayRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    if (state.lassoPath.length > 1) {
      drawLasso(ctx, state.lassoPath, new Set(state.selectedStrokeIds), page?.strokes ?? []);
    }
  }, [state.lassoPath, state.selectedStrokeIds]);

  // ── Coordinate conversion ───────────────────────────────────────────────────

  function pos(e) {
    const c    = overlayRef.current;
    const rect = c.getBoundingClientRect();
    const sx   = rect.width  > 0 ? c.width  / rect.width  : 1;
    const sy   = rect.height > 0 ? c.height / rect.height : 1;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy, pressure: e.pressure > 0 ? e.pressure : 0.5 };
  }

  function containerPos(e) {
    const c    = containerRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (pageWidth  / rect.width),
      y: (e.clientY - rect.top)  * (pageHeight / rect.height),
    };
  }

  // ── Drawing tools (adapted from Canvas.js) ──────────────────────────────────

  function makeStroke(pts) {
    const hl = state.currentTool === "highlighter";
    return { id: uid(), tool: hl ? "highlighter" : "pen", color: hl ? state.highlighterColor : state.penColor, width: hl ? state.highlighterWidth : state.penWidth, points: pts };
  }

  function penDown(p)  { sess.current.drawing = true; sess.current.currentPts = [[p.x, p.y, p.pressure]]; }

  function drawPenHover(p) {
    const hl = state.currentTool === "highlighter";
    const oct = overlayRef.current.getContext("2d");
    oct.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    drawPenCursor(oct, p.x, p.y, (hl ? state.highlighterWidth : state.penWidth) / 2, hl ? state.highlighterColor : state.penColor);
  }

  function penMove(p) {
    if (!sess.current.drawing) { drawPenHover(p); return; }
    sess.current.currentPts.push([p.x, p.y, p.pressure]);
    const oct = overlayRef.current.getContext("2d");
    oct.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    renderStroke(oct, makeStroke(sess.current.currentPts));
    const hl = state.currentTool === "highlighter";
    drawPenCursor(oct, p.x, p.y, (hl ? state.highlighterWidth : state.penWidth) / 2, hl ? state.highlighterColor : state.penColor);
  }

  function penUp() {
    if (!sess.current.drawing) return;
    sess.current.drawing = false;
    const pts = sess.current.currentPts;
    if (!pts.length) return;
    const stroke = makeStroke(pts);
    // paint to stroke canvas immediately to avoid flash
    const sctx = strokeRef.current?.getContext("2d");
    if (sctx) renderStroke(sctx, stroke);
    overlayRef.current.getContext("2d").clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    dispatch({ type: "ADD_STROKE", stroke });
    sess.current.currentPts = [];
    onSave?.();
  }

  function eraserMove(p) {
    const oct = overlayRef.current.getContext("2d");
    oct.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    drawEraserCursor(oct, p.x, p.y, state.eraserWidth / 2);
    if (!sess.current.erasing) return;
    const src = sess.current.pendingErasedStrokes ?? page?.strokes ?? [];
    const result = state.eraserMode === "precise"
      ? preciseErase(src, p.x, p.y, state.eraserWidth / 2)
      : strokeErase(src, p.x, p.y, state.eraserWidth / 2);
    if (result.changed) {
      sess.current.pendingErasedStrokes = result.strokes;
      redrawStrokes(result.strokes);
      clearTimeout(sess.current.eraseTimer);
      sess.current.eraseTimer = setTimeout(() => {
        dispatch({ type: "SET_STROKES", strokes: sess.current.pendingErasedStrokes, pushUndo: true });
        sess.current.pendingErasedStrokes = null;
        onSave?.();
      }, 500);
    }
  }

  function eraserLeave() {
    overlayRef.current?.getContext("2d")?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
  }

  function lassoDown(p) {
    if (state.selectedStrokeIds.length > 0) {
      sess.current.dragging = true; sess.current.dragStart = p;
      sess.current.dragBaseStrokes = page?.strokes ?? [];
      return;
    }
    sess.current.lasso = true; sess.current.lassoPath = [[p.x, p.y]];
    dispatch({ type: "CLEAR_SELECTION" });
  }

  function lassoMove(p) {
    const oct = overlayRef.current.getContext("2d");
    oct.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    if (sess.current.dragging) {
      const moved = translateStrokes(sess.current.dragBaseStrokes, state.selectedStrokeIds, p.x - sess.current.dragStart.x, p.y - sess.current.dragStart.y);
      redrawStrokes(moved); return;
    }
    if (!sess.current.lasso) return;
    sess.current.lassoPath.push([p.x, p.y]);
    drawLasso(oct, sess.current.lassoPath, new Set(), []);
  }

  function lassoUp(p) {
    if (sess.current.dragging) {
      const moved = translateStrokes(sess.current.dragBaseStrokes, state.selectedStrokeIds, p.x - sess.current.dragStart.x, p.y - sess.current.dragStart.y);
      dispatch({ type: "MOVE_SELECTED_STROKES", strokes: moved });
      sess.current.dragging = false; onSave?.(); return;
    }
    if (!sess.current.lasso) return;
    sess.current.lasso = false;
    const path = sess.current.lassoPath; sess.current.lassoPath = [];
    const ids = findStrokesInLasso(page?.strokes ?? [], path);
    dispatch({ type: "SET_LASSO_PATH", path });
    dispatch({ type: "SET_SELECTED_STROKES", ids });
  }

  // ── Canvas pointer events ───────────────────────────────────────────────────

  const onOverlayDown = useCallback((e) => {
    if (e.pointerType === "touch" && !e.isPrimary) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = state.currentTool, p = pos(e);
    if (t === "pen" || t === "highlighter") penDown(p);
    else if (t === "eraser") { sess.current.erasing = true; eraserMove(p); }
    else if (t === "select") lassoDown(p);
  }, [state]);

  const onOverlayMove = useCallback((e) => {
    if (e.pointerType === "touch" && !e.isPrimary) return;
    const t = state.currentTool;
    // Use coalesced events to capture all intermediate stylus positions that
    // the browser batched between frames — prevents broken/jagged lines.
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const p = pos(ev);
      if (t === "pen" || t === "highlighter") penMove(p);
      else if (t === "eraser") eraserMove(p);
      else if (t === "select") lassoMove(p);
    }
  }, [state]);

  const onOverlayUp = useCallback((e) => {
    if (e.pointerType === "touch" && !e.isPrimary) return;
    const t = state.currentTool, p = pos(e);
    if (t === "pen" || t === "highlighter") penUp();
    else if (t === "eraser") { sess.current.erasing = false; eraserLeave(); }
    else if (t === "select") lassoUp(p);
  }, [state]);

  // ── Mindmap: node drag ───────────────────────────────────────────────────────

  function onNodeDown(e, node) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(node.id);
    const p = containerPos(e);
    mmSess.current.draggingId = node.id;
    mmSess.current.dragOffset = { x: p.x - node.x, y: p.y - node.y };
  }

  function onNodeMove(e, node) {
    if (mmSess.current.draggingId !== node.id) return;
    const p = containerPos(e);
    setMmDragState({ id: node.id, x: p.x - mmSess.current.dragOffset.x, y: p.y - mmSess.current.dragOffset.y });
  }

  function onNodeUp(e, node) {
    if (mmSess.current.draggingId !== node.id) return;
    mmSess.current.draggingId = null;
    if (mmDragState?.id === node.id) {
      const newNodes = nodes.map((n) => n.id === node.id ? { ...n, x: mmDragState.x, y: mmDragState.y } : n);
      updateMM({ nodes: newNodes, connections: conns }, true);
      setMmDragState(null);
    }
  }

  // ── Mindmap: text edit ───────────────────────────────────────────────────────

  function startEdit(node) {
    setEditingId(node.id);
    setEditText(node.text ?? "");
    setSelectedId(node.id);
  }

  function commitEdit(node) {
    if (!editingId) return;
    const el = nodeElRefs.current[node.id];
    const h = el ? Math.max(el.offsetHeight, NODE_H) : NODE_H;
    const newNodes = nodes.map((n) => n.id === node.id ? { ...n, text: editText, height: h } : n);
    updateMM({ nodes: newNodes, connections: conns }, true);
    setEditingId(null);
  }

  function cancelEdit() { setEditingId(null); }

  // ── Mindmap: add / delete ────────────────────────────────────────────────────

  function onSvgDblClick(e) {
    if (e.target !== e.currentTarget) return;
    const p = containerPos(e);
    const newNode = { id: `n-${uid()}`, x: p.x - NODE_W / 2, y: p.y - NODE_H / 2, width: NODE_W, height: NODE_H, text: "", color: "white" };
    updateMM({ nodes: [...nodes, newNode], connections: conns }, true);
    setTimeout(() => { setEditingId(newNode.id); setEditText(""); setSelectedId(newNode.id); }, 0);
  }

  function deleteSelected() {
    if (!selectedId) return;
    const nodeIds = nodes.map((n) => n.id);
    if (nodeIds.includes(selectedId)) {
      updateMM({ nodes: nodes.filter((n) => n.id !== selectedId), connections: conns.filter((c) => c.sourceId !== selectedId && c.targetId !== selectedId) }, true);
    } else {
      updateMM({ nodes, connections: conns.filter((c) => c.id !== selectedId) }, true);
    }
    setSelectedId(null);
  }

  function changeNodeColor(nodeId, color) {
    updateMM({ nodes: nodes.map((n) => n.id === nodeId ? { ...n, color } : n), connections: conns });
  }

  // ── Mindmap: connections ─────────────────────────────────────────────────────

  function startConnect(e, node, port) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const sp = portPos(node, port);
    setConnecting({ nodeId: node.id, port, x: sp.x, y: sp.y });
    setTempCursor({ x: sp.x, y: sp.y });
  }

  function onPortMove(e) {
    if (!connecting) return;
    const p = containerPos(e);
    setTempCursor({ x: p.x, y: p.y });
  }

  function onPortUp(e, thisNodeId, thisPort) {
    if (!connecting) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    // find port under cursor
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    let targetNodeId = null, targetPort = null;
    for (const el of els) {
      if (el.dataset.nodeId && el.dataset.port) { targetNodeId = el.dataset.nodeId; targetPort = el.dataset.port; break; }
    }
    if (targetNodeId && targetNodeId !== connecting.nodeId) {
      const newConn = { id: `c-${uid()}`, sourceId: connecting.nodeId, targetId: targetNodeId, sourcePort: connecting.port, targetPort: targetPort ?? "left" };
      updateMM({ nodes, connections: [...conns, newConn] }, true);
    }
    setConnecting(null);
    setTempCursor(null);
  }

  // ── Keyboard delete ──────────────────────────────────────────────────────────

  function onContainerKeyDown(e) {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !editingId) {
      e.preventDefault();
      deleteSelected();
    }
    if (e.key === "Escape") { setSelectedId(null); cancelEdit(); }
  }

  // ── Cursor ──────────────────────────────────────────────────────────────────

  const overlayPE = (state.currentTool === "pen" || state.currentTool === "highlighter" || state.currentTool === "eraser" || state.currentTool === "select") ? "auto" : "none";

  const cursor = {
    pen: "none", highlighter: "none", eraser: "none",
    select: "default", pan: "grab", mindmap: "default",
  }[state.currentTool] ?? "crosshair";

  // ── Render ──────────────────────────────────────────────────────────────────

  const isMindmapTool = state.currentTool === "mindmap";
  const nodePE = isMindmapTool ? "auto" : "none";

  // Selected node for floating toolbar
  const selectedNode = nodes.find((n) => n.id === selectedId);

  // Selected connection delete button — compute bezier midpoint at t=0.5
  const selectedConn = isMindmapTool ? conns.find((c) => c.id === selectedId) : null;
  let connDeletePos = null;
  if (selectedConn) {
    const csrc = nodes.find((n) => n.id === selectedConn.sourceId);
    const ctgt = nodes.find((n) => n.id === selectedConn.targetId);
    if (csrc && ctgt) {
      const sp = portPos(csrc, selectedConn.sourcePort);
      const tp = portPos(ctgt, selectedConn.targetPort);
      const [sdx, sdy] = PORT_DIRS[selectedConn.sourcePort] ?? [0, 0];
      const [tdx, tdy] = PORT_DIRS[selectedConn.targetPort] ?? [0, 0];
      connDeletePos = {
        x: (sp.x + 3 * (sp.x + sdx) + 3 * (tp.x + tdx) + tp.x) / 8,
        y: (sp.y + 3 * (sp.y + sdy) + 3 * (tp.y + tdy) + tp.y) / 8,
      };
    }
  }

  return h("div", {
    ref: containerRef,
    tabIndex: 0,
    onKeyDown: onContainerKeyDown,
    style: { position: "absolute", inset: 0, outline: "none", width: `${pageWidth}px`, height: `${pageHeight}px`, overflow: "hidden" },
  },

    // Layer 1: background canvas
    h("canvas", { ref: bgRef, style: { position: "absolute", inset: 0, zIndex: 0 } }),

    // Layer 2: SVG connections
    h("svg", {
      style: { position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: nodePE, overflow: "visible" },
      onDblClick: isMindmapTool ? onSvgDblClick : undefined,
      onPointerDown: isMindmapTool ? (e) => { if (e.target.tagName === "svg") { setSelectedId(null); } } : undefined,
    },
      h("defs", null,
        h("marker", { id: "mm-arrow", markerWidth: 8, markerHeight: 6, refX: 8, refY: 3, orient: "auto" },
          h("polygon", { points: "0 0, 8 3, 0 6", fill: "#94a3b8" })
        ),
        h("marker", { id: "mm-arrow-sel", markerWidth: 8, markerHeight: 6, refX: 8, refY: 3, orient: "auto" },
          h("polygon", { points: "0 0, 8 3, 0 6", fill: "#6366f1" })
        )
      ),
      conns.map((conn) => {
        const src = nodes.find((n) => n.id === conn.sourceId);
        const tgt = nodes.find((n) => n.id === conn.targetId);
        if (!src || !tgt) return null;
        const sp = portPos(src, conn.sourcePort);
        const tp = portPos(tgt, conn.targetPort);
        const sel = selectedId === conn.id;
        return h("path", {
          key: conn.id,
          d: bezierD(sp, tp, conn.sourcePort, conn.targetPort),
          fill: "none",
          stroke: sel ? "#6366f1" : "#94a3b8",
          "stroke-width": sel ? 2.5 : 1.5,
          "marker-end": sel ? "url(#mm-arrow-sel)" : "url(#mm-arrow)",
          style: { cursor: "pointer" },
          onPointerDown: isMindmapTool ? (e) => { e.stopPropagation(); setSelectedId(conn.id); } : undefined,
        });
      }),
      // Temporary connection bezier (mirrors source direction for target approach)
      connecting && tempCursor && (() => {
        const [sdx, sdy] = PORT_DIRS[connecting.port] ?? [0, 0];
        const d = `M ${connecting.x} ${connecting.y} C ${connecting.x+sdx} ${connecting.y+sdy} ${tempCursor.x-sdx} ${tempCursor.y-sdy} ${tempCursor.x} ${tempCursor.y}`;
        return h("path", { d, fill: "none", stroke: "#6366f1", "stroke-width": 1.5, "stroke-dasharray": "4 2", "pointer-events": "none" });
      })()
    ),

    // Layer 3: node divs
    h("div", { style: { position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" } },
      nodes.map((node) => {
        const c    = NODE_COLORS[node.color] ?? NODE_COLORS.white;
        const dx   = mmDragState?.id === node.id ? mmDragState.x : node.x;
        const dy   = mmDragState?.id === node.id ? mmDragState.y : node.y;
        const sel  = selectedId === node.id;
        const edit = editingId === node.id;
        return h("div", {
          key: node.id,
          ref: (el) => { if (el) nodeElRefs.current[node.id] = el; },
          class: ["mm-node", sel && "selected"].filter(Boolean).join(" "),
          style: {
            left: `${dx}px`, top: `${dy}px`,
            width: `${node.width ?? NODE_W}px`,
            background: c.bg, borderColor: c.border, color: c.text,
            pointerEvents: nodePE,
            touchAction: "none",
            zIndex: sel ? 3 : 2,
          },
          onPointerDown: (e) => { if (!edit) onNodeDown(e, node); },
          onPointerMove: (e) => onNodeMove(e, node),
          onPointerUp:   (e) => onNodeUp(e, node),
          onDblClick:    (e) => { e.stopPropagation(); startEdit(node); },
        },
          edit
            ? h("textarea", {
                class: "mm-node-edit",
                value: editText,
                onInput:   (e) => setEditText(e.target.value),
                onBlur:    () => commitEdit(node),
                onKeyDown: (e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(node); }
                  if (e.key === "Escape") cancelEdit();
                  e.stopPropagation();
                },
                autoFocus: true,
              })
            : h("span", { class: "mm-node-text" }, node.text || h("em", { style: "opacity:.4;font-size:12px" }, "雙擊編輯")),
          // Port circles (show on hover / selected)
          isMindmapTool && ["top", "right", "bottom", "left"].map((prt) =>
            h("div", {
              key: prt,
              class: `mm-port mm-port-${prt}`,
              "data-node-id": node.id,
              "data-port": prt,
              onPointerDown: (e) => startConnect(e, node, prt),
              onPointerMove: (e) => onPortMove(e),
              onPointerUp:   (e) => onPortUp(e, node.id, prt),
            })
          )
        );
      })
    ),

    // Floating node toolbar (color + delete) for selected node
    selectedNode && isMindmapTool && !editingId && h(NodeToolbar, {
      node: selectedNode,
      onColorChange: (c) => changeNodeColor(selectedNode.id, c),
      onDelete: deleteSelected,
    }),

    // Delete button at midpoint of selected connection
    connDeletePos && h("button", {
      class: "mm-conn-delete-btn",
      title: "刪除連線 (Del)",
      style: { position: "absolute", left: `${connDeletePos.x}px`, top: `${connDeletePos.y}px`, transform: "translate(-50%, -50%)", zIndex: 20 },
      onPointerDown: (e) => e.stopPropagation(),
      onClick: () => deleteSelected(),
    }, "✕"),

    // Layer 4: stroke canvas (transparent, always on top of nodes)
    h("canvas", { ref: strokeRef, style: { position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" } }),

    // Layer 5: overlay canvas (drawing cursor + active stroke)
    h("canvas", {
      ref: overlayRef,
      style: { position: "absolute", inset: 0, zIndex: 11, cursor, touchAction: "none", pointerEvents: overlayPE },
      onPointerDown:  onOverlayDown,
      onPointerMove:  onOverlayMove,
      onPointerUp:    onOverlayUp,
      onPointerCancel: onOverlayUp,
      onPointerLeave: () => {
        // Never clear the live stroke preview while actively drawing.
        if (sess.current.drawing || sess.current.erasing || sess.current.lasso || sess.current.dragging) return;
        if (state.currentTool === "eraser") eraserLeave();
        else overlayRef.current?.getContext("2d")?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      },
    })
  );
}

// ── Node floating toolbar ─────────────────────────────────────────────────────

function NodeToolbar({ node, onColorChange, onDelete }) {
  const x = (node.x ?? 0) + (node.width ?? NODE_W) / 2;
  const y = (node.y ?? 0) - 42;
  return h("div", {
    class: "mm-node-toolbar",
    style: { position: "absolute", left: `${x}px`, top: `${y}px`, transform: "translateX(-50%)", zIndex: 20, pointerEvents: "auto" },
    onPointerDown: (e) => e.stopPropagation(),
  },
    COLOR_KEYS.map((key) =>
      h("button", {
        key,
        class: ["mm-color-btn", node.color === key && "active"].filter(Boolean).join(" "),
        style: { background: NODE_COLORS[key].bg, borderColor: node.color === key ? "#6366f1" : NODE_COLORS[key].border },
        title: key,
        onClick: () => onColorChange(key),
      })
    ),
    h("div", { style: { width: 1, background: "#e5e7eb", margin: "0 2px" } }),
    h("button", { class: "mm-delete-btn", title: "刪除 (Del)", onClick: onDelete }, "✕")
  );
}

// ── Export helper (used by export-utils.js) ───────────────────────────────────

export function renderMindmapToCanvas(ctx, mindmap) {
  const nodes = mindmap?.nodes ?? [];
  const conns = mindmap?.connections ?? [];

  // Draw connections first (below nodes)
  ctx.save();
  conns.forEach((conn) => {
    const src = nodes.find((n) => n.id === conn.sourceId);
    const tgt = nodes.find((n) => n.id === conn.targetId);
    if (!src || !tgt) return;
    const sp = portPos(src, conn.sourcePort);
    const tp = portPos(tgt, conn.targetPort);
    const [sdx, sdy] = PORT_DIRS[conn.sourcePort] ?? [0, 0];
    const [tdx, tdy] = PORT_DIRS[conn.targetPort] ?? [0, 0];
    ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sp.x, sp.y);
    ctx.bezierCurveTo(sp.x + sdx, sp.y + sdy, tp.x + tdx, tp.y + tdy, tp.x, tp.y);
    ctx.stroke();
    // Arrowhead
    const ang = { top: -Math.PI/2, right: 0, bottom: Math.PI/2, left: Math.PI }[conn.targetPort] ?? 0;
    ctx.save(); ctx.translate(tp.x, tp.y); ctx.rotate(ang);
    ctx.fillStyle = "#94a3b8"; ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-8, -4); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  // Draw nodes
  nodes.forEach((node) => {
    const c = NODE_COLORS[node.color] ?? NODE_COLORS.white;
    const w = node.width ?? NODE_W, h = node.height ?? NODE_H;
    ctx.save();
    ctx.fillStyle = c.bg; ctx.strokeStyle = c.border; ctx.lineWidth = 2;
    _roundRect(ctx, node.x, node.y, w, h, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.text; ctx.font = "14px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(node.text ?? "", node.x + w / 2, node.y + h / 2, w - 16);
    ctx.restore();
  });
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
