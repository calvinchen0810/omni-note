import { renderAllStrokes, renderStroke, drawPageBackground } from "./canvas-utils.js";
import { renderMindmapToCanvas } from "./components/MindMapCanvas.js";

// ── Canvas rendering ──────────────────────────────────────────────────────────

function getExportDimensions() {
  const canvas = document.querySelector(".canvas-wrapper canvas");
  return canvas && canvas.width > 0
    ? { width: canvas.width, height: canvas.height }
    : { width: 1600, height: 1200 };
}

function loadBgImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function renderPageToOffscreen(page, width, height, withBg = true, fallbackWhite = false) {
  const offscreen = document.createElement("canvas");
  offscreen.width  = width;
  offscreen.height = height;
  const ctx = offscreen.getContext("2d");

  if (withBg) {
    const bg = page.background ?? { type: "blank" };
    let bgImage = null;
    if (bg.type === "image") {
      bgImage = await loadBgImage(new URL(`backgrounds/${page.id}?t=${bg.ts ?? 0}`, window.location.href).href);
    }
    drawPageBackground(ctx, width, height, bg, bgImage);
  } else if (fallbackWhite) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  // Render mindmap nodes + connections below strokes
  if (page.mindmap?.nodes?.length) {
    renderMindmapToCanvas(ctx, page.mindmap);
  }

  renderAllStrokes(ctx, page.strokes ?? []);
  renderStickyNotesOnCanvas(ctx, page.sticky_notes ?? []);
  return offscreen;
}

// ── PNG export ────────────────────────────────────────────────────────────────

export async function exportCurrentPageAsPng(page, filename, withBg = true) {
  const { width, height } = getExportDimensions();
  const canvas = await renderPageToOffscreen(page, width, height, withBg, false);
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ── PDF export (all pages) ────────────────────────────────────────────────────

export async function exportAllPagesAsPdf(pages, filename, withBg = true) {
  const { jsPDF } = await import("https://esm.sh/jspdf@2.5.1");
  const { width, height } = getExportDimensions();
  const orient = width >= height ? "landscape" : "portrait";

  const pdf = new jsPDF({
    orientation: orient,
    unit: "px",
    format: [width, height],
    hotfixes: ["px_scaling"],
  });

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage([width, height], orient);
    const canvas = await renderPageToOffscreen(pages[i], width, height, withBg, true);
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, width, height);
  }

  pdf.save(`${filename}.pdf`);
}

const STICKY_HANDLE_H = 22;

// ── Sticky notes canvas rendering ─────────────────────────────────────────────

function parseStickyContent(content) {
  try {
    const obj = JSON.parse(content || "{}");
    const raw = Array.isArray(obj.strokes) ? obj.strokes : [];
    const strokes = raw.map((s) => {
      if (!s) return null;
      if (Array.isArray(s.points)) return s;
      if (Array.isArray(s.pts)) return { ...s, points: s.pts.map((p) => [p[0], p[1], p[2] ?? 0.5]) };
      return null;
    }).filter(Boolean);
    return { strokes, opacity: typeof obj.opacity === "number" ? obj.opacity : 1.0 };
  } catch {
    return { strokes: [], opacity: 1.0 };
  }
}

function renderStickyNotesOnCanvas(ctx, notes) {
  for (const note of notes) {
    const { strokes, opacity } = parseStickyContent(note.content);
    const color = note.color || "#fff6bf";

    ctx.save();
    ctx.globalAlpha = opacity;

    // Body background
    ctx.fillStyle = color;
    drawRoundRect(ctx, note.x, note.y, note.width, note.height, 6);
    ctx.fill();

    // Handle bar (subtle darker strip at top)
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    drawRoundRectTop(ctx, note.x, note.y, note.width, STICKY_HANDLE_H, 6);
    ctx.fill();

    // Clip to drawing area below the handle and render strokes
    if (strokes.length > 0) {
      ctx.beginPath();
      ctx.rect(note.x, note.y + STICKY_HANDLE_H, note.width, note.height - STICKY_HANDLE_H);
      ctx.clip();
      ctx.translate(note.x, note.y + STICKY_HANDLE_H);
      for (const stroke of strokes) renderStroke(ctx, stroke);
    }

    ctx.restore();
  }
}


function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

function drawRoundRectTop(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

