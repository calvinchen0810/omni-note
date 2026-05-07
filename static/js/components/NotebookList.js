import { h } from "https://esm.sh/preact@10.19.3";
import { useState } from "https://esm.sh/preact@10.19.3/hooks";

export function NotebookList({ notebooks, onOpen, onCreate, onDelete, onRename }) {
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
    return new Date(dt).toLocaleDateString("zh-TW", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  return h("div", { class: "notebook-list" },
    h("div", { class: "list-header" },
      h("h1", { class: "app-title" }, "📓 OmniNote"),
      h("button", {
        class: "btn-primary",
        onClick: () => { setCreating(true); setNewTitle(""); },
      }, "+ 新增筆記本")
    ),

    creating && h("form", { class: "create-form", onSubmit: submitCreate },
      h("input", {
        type: "text",
        class: "input-field",
        placeholder: "筆記本名稱",
        value: newTitle,
        autoFocus: true,
        onInput: (e) => setNewTitle(e.target.value),
      }),
      h("div", { class: "form-actions" },
        h("button", { type: "submit", class: "btn-primary" }, "建立"),
        h("button", {
          type: "button", class: "btn-secondary",
          onClick: () => setCreating(false),
        }, "取消")
      )
    ),

    notebooks.length === 0 && !creating
      ? h("div", { class: "empty-state" },
          h("div", { class: "empty-icon" }, "📓"),
          h("p", null, "尚無筆記本，點擊上方按鈕新增。")
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
                  h("span", null, `${nb.page_count} 頁`),
                  h("span", null, "·"),
                  h("span", null, fmt(nb.updated_at))
                )
              ),
              h("div", { class: "card-actions" },
                h("button", {
                  class: "icon-btn",
                  title: "重新命名",
                  onClick: (e) => {
                    e.stopPropagation();
                    setEditingId(nb.id);
                    setEditTitle(nb.title);
                  },
                }, "✏️"),
                h("button", {
                  class: "icon-btn danger",
                  title: "刪除",
                  onClick: (e) => {
                    e.stopPropagation();
                    if (confirm(`確定刪除「${nb.title}」？`)) onDelete(nb.id);
                  },
                }, "🗑")
              )
            )
          )
        )
  );
}
