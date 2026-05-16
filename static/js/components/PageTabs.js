import { h } from "https://esm.sh/preact@10.19.3";
import { useState, useRef, useEffect } from "https://esm.sh/preact@10.19.3/hooks";

const TYPE_ICON = { handwriting: "✏️", mindmap: "🧠" };

function TabLabel({ page, index, onRename }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  function startEdit(e) {
    e.stopPropagation();
    setValue(page.title ?? "");
    setEditing(true);
  }

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  function commit() {
    setEditing(false);
    onRename?.(page.id, value.trim());
  }

  if (editing) {
    return h("input", {
      ref: inputRef,
      class: "page-tab-rename-input",
      value,
      onInput: (e) => setValue(e.target.value),
      onBlur: commit,
      onKeyDown: (e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        if (e.key === "Escape") setEditing(false);
        e.stopPropagation();
      },
      onClick: (e) => e.stopPropagation(),
    });
  }

  const label = page.title || `第 ${index + 1} 頁`;
  return h("span", { class: "page-tab-label", onDblClick: startEdit, title: "雙擊重新命名" }, label);
}

export function PageTabs({ state, dispatch, onAddPage, onDeletePage, onRenamePage }) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  function addPage(type) {
    setShowAddMenu(false);
    onAddPage?.(type);
  }

  return h("div", { class: "page-tabs" },

    // Scrollable tabs area
    h("div", { class: "page-tabs-scroll" },
      state.pages.map((page, i) =>
        h("div", {
          key: page.id,
          class: ["page-tab", i === state.currentPageIndex && "active"].filter(Boolean).join(" "),
          onClick: () => dispatch({ type: "SET_PAGE_INDEX", index: i }),
        },
          h("span", { class: "page-tab-icon" }, TYPE_ICON[page.page_type ?? "handwriting"] ?? "✏️"),
          h(TabLabel, { page, index: i, onRename: onRenamePage }),
          state.pages.length > 1 && i === state.currentPageIndex &&
            h("button", {
              class: "tab-delete",
              title: "刪除此頁",
              onClick: (e) => {
                e.stopPropagation();
                if (confirm(`確定要刪除第 ${i + 1} 頁？此操作無法復原。`)) {
                  onDeletePage?.(page.id);
                }
              },
            }, "×")
        )
      )
    ),

    // Add button + popup (outside scroll area so popup is never clipped)
    h("div", { class: "page-tabs-add-wrap" },
      h("button", {
        class: "page-tab add-tab",
        title: "新增頁面",
        onClick: () => setShowAddMenu((v) => !v),
      }, "+"),

      showAddMenu && h("div", { class: "add-page-menu" },
        h("button", { class: "add-page-item", onClick: () => addPage("handwriting") },
          h("span", { class: "add-page-icon" }, "✏️"),
          h("span", null, "手寫頁")
        ),
        h("button", { class: "add-page-item", onClick: () => addPage("mindmap") },
          h("span", { class: "add-page-icon" }, "🧠"),
          h("span", null, "心智圖")
        )
      ),

      // Backdrop — closes menu when clicking anywhere outside
      showAddMenu && h("div", {
        style: { position: "fixed", inset: 0, zIndex: 149 },
        onClick: () => setShowAddMenu(false),
      })
    )
  );
}
