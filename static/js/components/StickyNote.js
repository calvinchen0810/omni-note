import { h } from "https://esm.sh/preact@10.19.3";
import { useState, useRef, useCallback } from "https://esm.sh/preact@10.19.3/hooks";

const COLORS = ["#ffd60a", "#f783ac", "#74c0fc", "#a9e34b", "#ffa94d", "#e8e8e8"];

export function StickyNote({ note, onUpdate, onDelete, interactive = true }) {
  const [editing, setEditing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const dragRef = useRef(null);
  const noteRef = useRef(null);

  // ── Drag to move ───────────────────────────────────────────────────────────

  const onHeaderPointerDown = useCallback((e) => {
    if (editing || e.target.tagName === "BUTTON") return;
    e.preventDefault();
    const startX = e.clientX - note.x;
    const startY = e.clientY - note.y;

    function move(ev) {
      onUpdate({ x: ev.clientX - startX, y: ev.clientY - startY });
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [note.x, note.y, editing, onUpdate]);

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
        width:  Math.max(120, startW + ev.clientX - startX),
        height: Math.max(80,  startH + ev.clientY - startY),
      });
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [note.width, note.height, onUpdate]);

  const bgLight = lightenColor(note.color);

  return h("div", {
    ref: noteRef,
    class: "sticky-note",
    style: {
      left:          note.x + "px",
      top:           note.y + "px",
      width:         note.width + "px",
      height:        note.height + "px",
      background:    bgLight,
      borderTop:     `4px solid ${note.color}`,
      pointerEvents: interactive ? "auto" : "none",
      opacity:       interactive ? 1 : 0.6,
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
  // Return a very light version of the color for background
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},0.15)`;
  } catch {
    return "#fffde7";
  }
}
