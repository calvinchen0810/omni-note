import { h } from "https://esm.sh/preact@10.19.3";
import { useState } from "https://esm.sh/preact@10.19.3/hooks";

const TYPE_ICON = { handwriting: "✏️", mindmap: "🧠" };

export function PageTabs({ state, dispatch, onAddPage, onDeletePage }) {
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
          h("span", null, `第 ${i + 1} 頁`),
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
