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

  const label = page.title || `Page ${index + 1}`;
  return h("span", { class: "page-tab-label", onDblClick: startEdit, title: "Double-click to rename" }, label);
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
              title: "Delete page",
              onClick: (e) => {
                e.stopPropagation();
                if (confirm(`Delete page ${i + 1}? This cannot be undone.`)) {
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
        title: "Add page",
        onClick: () => onAddPage?.(),
      }, "+")
    )
  );
}

