import { h } from "https://esm.sh/preact@10.19.3";
import { useState, useRef } from "https://esm.sh/preact@10.19.3/hooks";
import { api } from "../api.js";

const THUMB_SCALE = 0.4;
const FULL_SCALE  = 2.0;

let _pdfjs = null;
async function getPdfJs() {
  if (_pdfjs) return _pdfjs;
  if (window.pdfjsLib) {
    _pdfjs = window.pdfjsLib;
    return _pdfjs;
  }
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  _pdfjs = window.pdfjsLib;
  _pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return _pdfjs;
}

async function renderToCanvas(pdfPage, scale) {
  const vp     = pdfPage.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width  = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  await pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
  return canvas;
}

async function pageToDataUrl(pdfPage) {
  return (await renderToCanvas(pdfPage, THUMB_SCALE)).toDataURL("image/jpeg", 0.8);
}

async function pageToBlob(pdfPage) {
  const canvas = await renderToCanvas(pdfPage, FULL_SCALE);
  return new Promise((res) => canvas.toBlob(res, "image/png"));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PdfImportModal({ notebookId, onClose, onImported }) {
  const [thumbs,   setThumbs]   = useState([]);          // [{ n, url }]
  const [selected, setSelected] = useState(new Set());
  const [phase,    setPhase]    = useState("idle");      // idle | loading | selecting | importing
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [loadedOf, setLoadedOf] = useState({ done: 0, total: 0 });
  const [error,    setError]    = useState("");
  const pdfDoc    = useRef(null);
  const fileInput = useRef(null);

  function toggle(n) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(n) ? s.delete(n) : s.add(n);
      return s;
    });
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === thumbs.length ? new Set() : new Set(thumbs.map(t => t.n))
    );
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhase("loading"); setError(""); setThumbs([]); setSelected(new Set());

    try {
      const pdfjs = await getPdfJs();
      const buf   = await file.arrayBuffer();
      const pdf   = await pdfjs.getDocument({ data: buf }).promise;
      pdfDoc.current = pdf;

      const total = pdf.numPages;
      setLoadedOf({ done: 0, total });
      const list = [];

      for (let n = 1; n <= total; n++) {
        const page = await pdf.getPage(n);
        const url  = await pageToDataUrl(page);
        list.push({ n, url });
        setThumbs([...list]);
        setLoadedOf({ done: n, total });
      }

      setSelected(new Set(list.map(t => t.n)));
      setPhase("selecting");
    } catch (err) {
      console.error(err);
      setError("Failed to load PDF. Please check the file format.");
      setPhase("idle");
    }
  }

  async function handleImport() {
    const pdf = pdfDoc.current;
    if (!pdf || selected.size === 0) return;

    const pageNums = [...selected].sort((a, b) => a - b);
    setPhase("importing");
    setProgress({ done: 0, total: pageNums.length });
    setError("");

    try {
      for (let i = 0; i < pageNums.length; i++) {
        const n       = pageNums[i];
        const pdfPage = await pdf.getPage(n);
        const blob    = await pageToBlob(pdfPage);
        const file    = new File([blob], `p${n}.png`, { type: "image/png" });

        const newPage = await api.createPage(notebookId, { type: "blank" }, "handwriting");
        await api.uploadBackgroundImage(newPage.id, file);

        setProgress({ done: i + 1, total: pageNums.length });
      }
      onImported();
    } catch (err) {
      console.error(err);
      setError("An error occurred during import. Please try again.");
      setPhase("selecting");
    }
  }

  const allSelected = thumbs.length > 0 && selected.size === thumbs.length;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return h("div", { class: "modal-overlay" },
    h("div", { class: "pdf-modal" },

      // Header
      h("div", { class: "cloud-modal-header" },
        h("span", { class: "cloud-modal-title" }, "Import PDF"),
        phase !== "importing" &&
          h("button", { class: "cloud-modal-close", onClick: onClose }, "✕")
      ),

      // ── idle: file picker ────────────────────────────────────────────────
      phase === "idle" && h("div", { class: "pdf-drop-area" },
        h("input", {
          ref: fileInput, type: "file", accept: "application/pdf",
          style: { display: "none" }, onChange: handleFile,
        }),
        h("svg", { viewBox: "0 0 24 24", width: 40, height: 40, fill: "none", stroke: "#9ca3af", "stroke-width": 1.5 },
          h("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
          h("polyline", { points: "14 2 14 8 20 8" }),
          h("line",     { x1: 12, y1: 18, x2: 12, y2: 12 }),
          h("polyline", { points: "9 15 12 12 15 15" })
        ),
        h("p",  { class: "pdf-drop-hint" }, "Select a PDF file to load thumbnails"),
        h("button", { class: "pdf-pick-btn", onClick: () => fileInput.current?.click() },
          "Choose file"
        )
      ),

      // ── loading: progressive thumbs ──────────────────────────────────────
      phase === "loading" && thumbs.length === 0 && h("div", { class: "pdf-status-center" },
        h("div", { class: "pdf-spinner" }),
        h("p", null, "Loading…")
      ),

      // Thumb grid (shown during loading + selecting)
      (phase === "loading" || phase === "selecting") && thumbs.length > 0 && h("div", { class: "pdf-thumb-section" },
        h("div", { class: "pdf-thumb-bar" },
          phase === "loading"
            ? h("span", { class: "pdf-thumb-bar-hint" }, `Loading thumbnails ${loadedOf.done} / ${loadedOf.total}…`)
            : h("span", null, `${selected.size} / ${thumbs.length} selected`),
          h("button", { class: "pdf-select-all-btn", onClick: toggleAll },
            allSelected ? "Deselect all" : "Select all"
          )
        ),
        h("div", { class: "pdf-thumb-grid" },
          thumbs.map(({ n, url }) =>
            h("div", {
              key: n,
              class: ["pdf-thumb-item", selected.has(n) && "selected"].filter(Boolean).join(" "),
              onClick: () => toggle(n),
            },
              h("img",  { src: url, class: "pdf-thumb-img", draggable: false }),
              h("div",  { class: "pdf-thumb-num" }, n),
              h("div",  { class: "pdf-check-circle" },
                selected.has(n) && h("svg", { viewBox: "0 0 12 12", width: 10, height: 10, fill: "none", stroke: "#fff", "stroke-width": 2 },
                  h("polyline", { points: "2 6 5 9 10 3" })
                )
              )
            )
          )
        )
      ),

      // ── importing: progress bar ──────────────────────────────────────────
      phase === "importing" && h("div", { class: "pdf-progress-wrap" },
        h("div", { class: "pdf-progress-meta" },
          h("span", null, `Importing page ${progress.done} / ${progress.total}`),
          h("span", null, `${pct}%`)
        ),
        h("div", { class: "pdf-progress-track" },
          h("div", { class: "pdf-progress-fill", style: { width: `${pct}%` } })
        )
      ),

      // Error
      error && h("p", { class: "cloud-error" }, error),

      // Footer
      phase === "selecting" && h("div", { class: "cloud-modal-footer" },
        h("button", { class: "cloud-btn-cancel", onClick: onClose }, "Cancel"),
        h("button", {
          class: "cloud-btn-primary",
          disabled: selected.size === 0,
          onClick: handleImport,
        }, `Import ${selected.size} ${selected.size === 1 ? "page" : "pages"}`)
      )
    )
  );
}
