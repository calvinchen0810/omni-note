import { h } from "https://esm.sh/preact@10.19.3";
import { useState } from "https://esm.sh/preact@10.19.3/hooks";

export function NotebookList({ notebooks, onOpen, onCreate, onDelete, onRename, user, onLogout }) {
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  function submitCreate(e) {
    e.preventDefault();
    const title = newTitle.trim() || "Untitled Notebook";
    onCreate(title);
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
    h("div", { class: "list-header" },
      h("h1", { class: "app-title" }, "📓 OmniNote"),
      h("div", { class: "list-header-actions" },
        user && h("span", { class: "list-user-badge" }, user.username),
        h("button", {
          class: "btn-primary",
          onClick: () => { setCreating(true); setNewTitle(""); },
        }, "+ New Notebook"),
        onLogout && h("button", { class: "btn-logout", onClick: onLogout, title: "Sign out" },
          h("svg", { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", "stroke-width": 2 },
            h("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }),
            h("polyline", { points: "16 17 21 12 16 7" }),
            h("line", { x1: 21, y1: 12, x2: 9, y2: 12 })
          ),
          "Sign out"
        ),
      )
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
          h("p", null, "No notebooks yet. Click the button above to create one.")
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
  );
}
