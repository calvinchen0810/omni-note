// ─── Stroke rendering ────────────────────────────────────────────────────────

export function renderStroke(ctx, stroke) {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;

  if (stroke.tool === "highlighter") {
    // Draw as one single path so multiply does not compound at overlapping segments.
    ctx.globalAlpha = 0.35;
    ctx.globalCompositeOperation = "multiply";
    ctx.lineWidth = stroke.width; // fixed width — no pressure variation

    if (pts.length === 1) {
      const [x, y] = pts[0];
      ctx.beginPath();
      ctx.arc(x, y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // ── Pen: pressure-sensitive bezier ───────────────────────────────────────
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = "source-over";

  if (pts.length === 1) {
    const [x, y, p = 0.5] = pts[0];
    ctx.beginPath();
    ctx.arc(x, y, (stroke.width * (0.4 + p * 0.6)) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (pts.length === 2) {
    const [x0, y0, p0 = 0.5] = pts[0];
    const [x1, y1, p1 = 0.5] = pts[1];
    ctx.lineWidth = stroke.width * (0.4 + ((p0 + p1) / 2) * 0.6);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  } else {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0, p0 = 0.5] = pts[i];
      const [x1, y1, p1 = 0.5] = pts[i + 1];
      const midX = (x0 + x1) / 2;
      const midY = (y0 + y1) / 2;

      ctx.lineWidth = stroke.width * (0.4 + ((p0 + p1) / 2) * 0.6);
      ctx.beginPath();

      if (i === 0) {
        ctx.moveTo(x0, y0);
        ctx.lineTo(midX, midY);
      } else {
        const [xp, yp] = pts[i - 1];
        ctx.moveTo((xp + x0) / 2, (yp + y0) / 2);
        ctx.quadraticCurveTo(x0, y0, midX, midY);
      }
      ctx.stroke();
    }
    const n = pts.length;
    const [xn2, yn2] = pts[n - 2];
    const [xn1, yn1, pn = 0.5] = pts[n - 1];
    ctx.lineWidth = stroke.width * (0.4 + pn * 0.6);
    ctx.beginPath();
    ctx.moveTo((xn2 + xn1) / 2, (yn2 + yn1) / 2);
    ctx.lineTo(xn1, yn1);
    ctx.stroke();
  }

  ctx.restore();
}

export function renderAllStrokes(ctx, strokes) {
  for (const stroke of strokes) renderStroke(ctx, stroke);
}

// ─── Eraser: precise (point-level) ───────────────────────────────────────────

export function preciseErase(strokes, ex, ey, radius) {
  let changed = false;
  const result = [];
  const r2 = radius * radius;

  for (const stroke of strokes) {
    const pts = stroke.points;
    let currentSeg = [];
    let strokeChanged = false;

    for (const pt of pts) {
      const dx = pt[0] - ex;
      const dy = pt[1] - ey;
      if (dx * dx + dy * dy <= r2) {
        strokeChanged = true;
        if (currentSeg.length >= 1) {
          result.push({ ...stroke, id: uid(), points: currentSeg });
          currentSeg = [];
        }
      } else {
        currentSeg.push(pt);
      }
    }

    if (!strokeChanged) {
      result.push(stroke);
    } else {
      changed = true;
      if (currentSeg.length >= 1) {
        result.push({ ...stroke, id: uid(), points: currentSeg });
      }
    }
  }

  return { strokes: result, changed };
}

// ─── Eraser: stroke-level ─────────────────────────────────────────────────────

export function strokeErase(strokes, ex, ey, radius) {
  const r2 = radius * radius;
  const removedIds = [];
  const result = strokes.filter((stroke) => {
    const hit = stroke.points.some(([x, y]) => {
      const dx = x - ex;
      const dy = y - ey;
      return dx * dx + dy * dy <= r2;
    });
    if (hit) removedIds.push(stroke.id);
    return !hit;
  });
  return { strokes: result, removedIds, changed: removedIds.length > 0 };
}

// ─── Lasso selection ──────────────────────────────────────────────────────────

export function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function findStrokesInLasso(strokes, lassoPath) {
  return strokes
    .filter((s) => s.points.some(([x, y]) => pointInPolygon(x, y, lassoPath)))
    .map((s) => s.id);
}

export function translateStrokes(strokes, selectedIds, dx, dy) {
  const idSet = new Set(selectedIds);
  return strokes.map((s) =>
    idSet.has(s.id)
      ? { ...s, points: s.points.map(([x, y, p = 0.5]) => [x + dx, y + dy, p]) }
      : s
  );
}

// ─── Overlay drawing ──────────────────────────────────────────────────────────

export function drawLasso(ctx, path, selectedIdSet, strokes) {
  if (path.length < 2) return;
  ctx.save();
  ctx.strokeStyle = "#4f8ef7";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(path[0][0], path[0][1]);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
  ctx.closePath();
  ctx.stroke();

  if (selectedIdSet && selectedIdSet.size > 0) {
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(79, 142, 247, 0.15)";
    ctx.fill();
  }
  ctx.restore();
}

export function drawEraserCursor(ctx, x, y, radius) {
  ctx.save();
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawPenCursor(ctx, x, y, radius, color) {
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = color || "#1a1a2e";
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPageBackground(ctx, w, h, bg = { type: "blank" }, bgImage = null) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const type = bg.type ?? "blank";

  if (type === "image") {
    if (bgImage) {
      const scale = bg.scale ?? 1.0;
      const fitScale = Math.min(w / bgImage.width, h / bgImage.height);
      const dw = bgImage.width  * fitScale * scale;
      const dh = bgImage.height * fitScale * scale;
      ctx.drawImage(bgImage, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }
    return;
  }

  const spacing   = bg.spacing   ?? 56;
  const thickness = bg.thickness ?? 1;

  if (type === "ruled") {
    ctx.strokeStyle = "#e8eaf0";
    ctx.lineWidth = thickness;
    for (let y = spacing; y < h; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.strokeStyle = "#f5c6cb";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, h); ctx.stroke();

  } else if (type === "grid") {
    ctx.strokeStyle = "#e8eaf0";
    ctx.lineWidth = thickness;
    for (let y = spacing; y < h; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let x = spacing; x < w; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

  } else if (type === "dot") {
    const dotSize = bg.size ?? 1.5;
    ctx.fillStyle = "#c8ccd8";
    for (let y = spacing; y < h; y += spacing) {
      for (let x = spacing; x < w; x += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // "blank" = white only
}

// ─── Util ─────────────────────────────────────────────────────────────────────

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
