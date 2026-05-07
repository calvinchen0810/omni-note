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
  createPage: (notebookId) => req("POST", `/notebooks/${notebookId}/pages`),
  updateStrokes: (pageId, strokes) => req("PUT", `/pages/${pageId}/strokes`, { strokes }),
  deletePage: (pageId) => req("DELETE", `/pages/${pageId}`),

  createStickyNote: (pageId, data) => req("POST", `/pages/${pageId}/sticky-notes`, data),
  updateStickyNote: (id, data) => req("PUT", `/sticky-notes/${id}`, data),
  deleteStickyNote: (id) => req("DELETE", `/sticky-notes/${id}`),
};
