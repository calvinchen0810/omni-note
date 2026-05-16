import { h } from "https://esm.sh/preact@10.19.3";
import { useState, useRef, useEffect } from "https://esm.sh/preact@10.19.3/hooks";

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
  return h("div", { class: "page-tabs" },

    h("div", { class: "page-tabs-scroll" },
      state.pages.map((page, i) =>
        h("div", {
          key: page.id,
          class: ["page-tab", i === state.currentPageIndex && "active"].filter(Boolean).join(" "),
          onClick: () => dispatch({ type: "SET_PAGE_INDEX", index: i }),
        },
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

    h("div", { class: "page-tabs-add-wrap" },
      h("button", {
        class: "page-tab add-tab",
        title: "新增頁面",
        onClick: () => onAddPage?.(),
      }, "+")
    )
  );
}

