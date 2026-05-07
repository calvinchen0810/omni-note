import { h } from "https://esm.sh/preact@10.19.3";

export function PageTabs({ state, dispatch, onAddPage, onDeletePage }) {
  return h("div", { class: "page-tabs" },
    state.pages.map((page, i) =>
      h("div", {
        key: page.id,
        class: ["page-tab", i === state.currentPageIndex && "active"].filter(Boolean).join(" "),
        onClick: () => dispatch({ type: "SET_PAGE_INDEX", index: i }),
      },
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
    ),
    h("button", {
      class: "page-tab add-tab",
      title: "新增頁面",
      onClick: onAddPage,
    }, "+")
  );
}
