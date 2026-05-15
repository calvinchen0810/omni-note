// Use relative path — no hardcoded host/port
const BASE = "api";

async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  listNotebooks: () => req("GET", "/notebooks"),
  createNotebook: (title) => req("POST", "/notebooks", { title }),
  updateNotebook: (id, title) => req("PUT", `/notebooks/${id}`, { title }),
  deleteNotebook: (id) => req("DELETE", `/notebooks/${id}`),

  listPages: (notebookId) => req("GET", `/notebooks/${notebookId}/pages`),
  createPage: (notebookId, background, page_type = "handwriting") =>
    req("POST", `/notebooks/${notebookId}/pages`, { background, page_type }),
  updateStrokes: (pageId, strokes) => req("PUT", `/pages/${pageId}/strokes`, { strokes }),
  updateMindmap: (pageId, mindmap) => req("PUT", `/pages/${pageId}/mindmap`, mindmap),
  deletePage: (pageId) => req("DELETE", `/pages/${pageId}`),

  updateBackground: (pageId, bg) => req("PUT", `/pages/${pageId}/background`, bg),

  uploadBackgroundImage: async (pageId, file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/pages/${pageId}/background-image`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`POST background-image → ${res.status}`);
    return res.json();
  },

  deleteBackgroundImage: (pageId) => req("DELETE", `/pages/${pageId}/background-image`),

  createStickyNote: (pageId, data) => req("POST", `/pages/${pageId}/sticky-notes`, data),
  updateStickyNote: (id, data) => req("PUT", `/sticky-notes/${id}`, data),
  deleteStickyNote: (id) => req("DELETE", `/sticky-notes/${id}`),

  cloudSave: (id, name, password, data) =>
    req("POST", "/cloud/save", { id, name, password, data }),
  cloudOpen: (id, password) =>
    req("POST", "/cloud/open", { id, password }),
  cloudMeta: (id, password) =>
    req("POST", "/cloud/meta", { id, password }),
};
