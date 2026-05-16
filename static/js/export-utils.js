import { renderAllStrokes, drawPageBackground } from "./canvas-utils.js";
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
      bgImage = await loadBgImage(`/backgrounds/${page.id}?t=${bg.ts ?? 0}`);
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

// ── Sticky notes canvas rendering ─────────────────────────────────────────────

function renderStickyNotesOnCanvas(ctx, notes) {
  for (const note of notes) {
    ctx.save();
    const [r, g, b] = hexToRgb(note.color);

    // Background
    ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
    ctx.strokeStyle = note.color;
    ctx.lineWidth = 2;
    drawRoundRect(ctx, note.x, note.y, note.width, note.height, 6);
    ctx.fill();
    ctx.stroke();

    // Header bar
    ctx.fillStyle = note.color;
    drawRoundRectTop(ctx, note.x, note.y, note.width, 24, 6);
    ctx.fill();

    // Text content
    if (note.content && note.content.trim()) {
      ctx.fillStyle = "#1a1a2e";
      ctx.font = "14px sans-serif";
      ctx.textBaseline = "top";
      const lines = wrapText(ctx, note.content, note.width - 20);
      let y = note.y + 32;
      for (const line of lines) {
        if (y + 18 > note.y + note.height - 6) break;
        ctx.fillText(line, note.x + 10, y);
        y += 20;
      }
    }

    ctx.restore();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  try {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  } catch {
    return [255, 214, 10];
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

function wrapText(ctx, text, maxWidth) {
  const result = [];
  for (const para of text.split("\n")) {
    if (!para) { result.push(""); continue; }
    let line = "";
    for (const word of para.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
      } else {
        if (line) result.push(line);
        line = word;
      }
    }
    if (line) result.push(line);
  }
  return result;
}
