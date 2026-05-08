import { h } from "https://esm.sh/preact@10.19.3";
import { useState, useRef, useCallback } from "https://esm.sh/preact@10.19.3/hooks";

const COLORS = ["#ffd60a", "#f783ac", "#74c0fc", "#a9e34b", "#ffa94d", "#e8e8e8"];

export function StickyNote({ note, onUpdate, onDelete, zoom = 1, interactive = true }) {
  const [editing, setEditing]   = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const noteRef = useRef(null);

  // ── Drag to move ───────────────────────────────────────────────────────────

  const onHeaderPointerDown = useCallback((e) => {
    if (editing || e.target.tagName === "BUTTON") return;
    e.preventDefault();
    const startScreenX = e.clientX;
    const startScreenY = e.clientY;
    const startNoteX   = note.x;
    const startNoteY   = note.y;

    function move(ev) {
      onUpdate({
        x: startNoteX + (ev.clientX - startScreenX) / zoom,
        y: startNoteY + (ev.clientY - startScreenY) / zoom,
      });
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [note.x, note.y, editing, onUpdate, zoom]);

  // ── Resize ─────────────────────────────────────────────────────────────────

  const onResizePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = note.width;
    const startH = note.height;

    function move(ev) {
      onUpdate({
        width:  Math.max(120, startW + (ev.clientX - startX) / zoom),
        height: Math.max(80,  startH + (ev.clientY - startY) / zoom),
      });
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [note.width, note.height, onUpdate, zoom]);

  const bgLight = lightenColor(note.color);

  return h("div", {
    ref: noteRef,
    class: "sticky-note",
    style: {
      left:    note.x * zoom + "px",
      top:     note.y * zoom + "px",
      width:   note.width  * zoom + "px",
      height:  note.height * zoom + "px",
      background: bgLight,
      borderTop: `${Math.max(2, 4 * zoom)}px solid ${note.color}`,
      pointerEvents: interactive ? "auto" : "none",
      opacity: interactive ? 1 : 0.6,
    },
  },
    // Header / drag handle
    h("div", {
      class: "sticky-header",
      style: { background: note.color },
      onPointerDown: onHeaderPointerDown,
    },
      h("div", { class: "sticky-dots" }, "⠿"),
      h("div", { style: { position: "relative" } },
        h("button", {
          class: "sticky-menu-btn",
          onClick: () => setShowMenu(!showMenu),
          title: "選項",
        }, "⋮"),
        showMenu && h("div", { class: "sticky-menu" },
          h("div", { class: "sticky-menu-label" }, "顏色"),
          h("div", { class: "sticky-colors" },
            COLORS.map((c) =>
              h("button", {
                key: c,
                class: ["color-dot", note.color === c && "selected"].filter(Boolean).join(" "),
                style: { background: c },
                onClick: () => { onUpdate({ color: c }); setShowMenu(false); },
              })
            )
          ),
          h("button", {
            class: "sticky-delete-btn",
            onClick: () => { setShowMenu(false); onDelete(); },
          }, "🗑 刪除")
        )
      )
    ),

    // Content area
    h("div", {
      class: "sticky-body",
      onDblClick: () => setEditing(true),
    },
      editing
        ? h("textarea", {
            class: "sticky-textarea",
            value: note.content,
            autoFocus: true,
            onInput: (e) => onUpdate({ content: e.target.value }),
            onBlur: () => setEditing(false),
          })
        : h("div", {
            class: "sticky-text",
            style: { whiteSpace: "pre-wrap" },
          }, note.content || h("span", { class: "sticky-placeholder" }, "雙擊輸入..."))
    ),

    // Resize handle
    h("div", {
      class: "sticky-resize",
      onPointerDown: onResizePointerDown,
    }, "⇲")
  );
}

function lightenColor(hex) {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},0.15)`;
  } catch {
    return "#fffde7";
  }
}
