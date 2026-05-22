import { h } from "https://esm.sh/preact@10.19.3";
import { useState } from "https://esm.sh/preact@10.19.3/hooks";

export function NotebookList({ notebooks, onOpen, onCreate, onDelete, onRename, user, onLogout, onWsAdmin }) {
  const [creating,  setCreating]  = useState(false);
  const [newTitle,  setNewTitle]  = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  function submitCreate(e) {
    e.preventDefault();
    onCreate(newTitle.trim() || "Untitled Notebook");
    setNewTitle("");
    setCreating(false);
  }

  function submitRename(e, id) {
    e.preventDefault();
    onRename(id, editTitle.trim() || "Untitled Notebook");
    setEditingId(null);
  }

  function fmt(dt) {
    return new Date(dt).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  return h("div", { class: "notebook-list" },

    // ── Top bar ──────────────────────────────────────────────────────────────
    h("div", { class: "list-topbar" },
      h("div", { class: "list-topbar-brand" },
        h("svg", { viewBox: "0 0 36 36", width: 26, height: 26, fill: "none" },
          h("rect", { width: 36, height: 36, rx: 9, fill: "#fff" }),
          h("path", { d: "M9 11h18M9 17h12M9 23h14", stroke: "#2563eb", "stroke-width": 2.5, "stroke-linecap": "round" })
        ),
        h("span", { class: "list-topbar-name" }, "OmniNote")
      ),
      h("div", { class: "list-topbar-right" },
        user && h("div", { class: "list-avatar", title: user.username },
          user.username.charAt(0).toUpperCase()
        ),
        onWsAdmin && h("button", {
          class: "list-signout-btn",
          onClick: onWsAdmin,
          title: "WebSocket Manager",
        },
          h("svg", { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 2 },
            h("path", { d: "M18 20V10" }),
            h("path", { d: "M12 20V4" }),
            h("path", { d: "M6 20v-6" })
          )
        ),
        onLogout && h("button", {
          class: "list-signout-btn",
          onClick: onLogout,
          title: "Sign out",
        },
          h("svg", { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 2 },
            h("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }),
            h("polyline", { points: "16 17 21 12 16 7" }),
            h("line", { x1: 21, y1: 12, x2: 9, y2: 12 })
          )
        )
      )
    ),

    // ── Body ─────────────────────────────────────────────────────────────────
    h("div", { class: "list-body" },

      h("div", { class: "list-section-header" },
        h("h2", { class: "list-section-title" }, "My Notebooks"),
        h("button", {
          class: "btn-primary",
          onClick: () => { setCreating(true); setNewTitle(""); },
        }, "+ New")
      ),

      creating && h("form", { class: "create-form", onSubmit: submitCreate },
        h("input", {
          type: "text",
          class: "input-field",
          placeholder: "Notebook name",
          value: newTitle,
          autoFocus: true,
          onInput: (e) => setNewTitle(e.target.value),
        }),
        h("div", { class: "form-actions" },
          h("button", { type: "submit", class: "btn-primary" }, "Create"),
          h("button", {
            type: "button", class: "btn-secondary",
            onClick: () => setCreating(false),
          }, "Cancel")
        )
      ),

      notebooks.length === 0 && !creating
        ? h("div", { class: "empty-state" },
            h("div", { class: "empty-icon" }, "📓"),
            h("p", null, "No notebooks yet. Create your first one!")
          )
        : h("div", { class: "notebooks-grid" },
            notebooks.map((nb) =>
              h("div", { key: nb.id, class: "notebook-card" },
                h("div", { class: "card-body", onClick: () => onOpen(nb) },
                  editingId === nb.id
                    ? h("form", {
                        onSubmit: (e) => submitRename(e, nb.id),
                        onClick: (e) => e.stopPropagation(),
                      },
                        h("input", {
                          type: "text",
                          class: "input-field",
                          value: editTitle,
                          autoFocus: true,
                          onInput: (e) => setEditTitle(e.target.value),
                          onBlur: (e) => submitRename(e, nb.id),
                        })
                      )
                    : h("h3", { class: "card-title" }, nb.title),
                  h("div", { class: "card-meta" },
                    h("span", null, `${nb.page_count} ${nb.page_count === 1 ? "page" : "pages"}`),
                    h("span", null, "·"),
                    h("span", null, fmt(nb.updated_at))
                  )
                ),
                h("div", { class: "card-actions" },
                  h("button", {
                    class: "icon-btn",
                    title: "Rename",
                    onClick: (e) => {
                      e.stopPropagation();
                      setEditingId(nb.id);
                      setEditTitle(nb.title);
                    },
                  }, "✏️"),
                  h("button", {
                    class: "icon-btn danger",
                    title: "Delete",
                    onClick: (e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${nb.title}"?`)) onDelete(nb.id);
                    },
                  }, "🗑")
                )
              )
            )
          )
    )
  );
}
