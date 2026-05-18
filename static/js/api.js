const BASE = "api";

// ── Token management ──────────────────────────────────────────────────────────

const TOKEN_KEY = "omni_token";

export const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t) => localStorage.setItem(TOKEN_KEY, t),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
};

// Called by app.js when a 401 is received
export let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

// ── Base fetch wrapper ────────────────────────────────────────────────────────

async function req(method, path, body) {
  const token = auth.getToken();
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (res.status === 401) {
    auth.clearToken();
    onUnauthorized?.();
    throw new Error("Unauthorized");
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

// ── API methods ───────────────────────────────────────────────────────────────

export const api = {
  // Auth
  register:        (username, email, password) => req("POST", "/auth/register", { username, email, password }),
  login:           (email, password)           => req("POST", "/auth/login", { email, password }),
  getMe:           ()                          => req("GET",  "/auth/me"),
  forgotPassword:  (email)                     => req("POST", "/auth/forgot-password", { email }),
  resetPassword:   (token, password)           => req("POST", "/auth/reset-password", { token, password }),

  // Notebooks
  listNotebooks:  () => req("GET", "/notebooks"),
  createNotebook: (title) => req("POST", "/notebooks", { title }),
  updateNotebook: (id, title) => req("PUT", `/notebooks/${id}`, { title }),
  deleteNotebook: (id) => req("DELETE", `/notebooks/${id}`),

  // Pages
  listPages:    (notebookId) => req("GET", `/notebooks/${notebookId}/pages`),
  createPage:   (notebookId, background, page_type = "handwriting") =>
    req("POST", `/notebooks/${notebookId}/pages`, { background, page_type }),
  updateStrokes:  (pageId, strokes) => req("PUT", `/pages/${pageId}/strokes`, { strokes }),
  updatePageTitle:(pageId, title)   => req("PUT", `/pages/${pageId}/title`, { title }),
  updateMindmap:  (pageId, mindmap) => req("PUT", `/pages/${pageId}/mindmap`, mindmap),
  deletePage:     (pageId)          => req("DELETE", `/pages/${pageId}`),

  updateBackground: (pageId, bg) => req("PUT", `/pages/${pageId}/background`, bg),

  uploadBackgroundImage: async (pageId, file) => {
    const token = auth.getToken();
    const form = new FormData();
    form.append("file", file);
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${BASE}/pages/${pageId}/background-image`, {
      method: "POST", body: form, headers,
    });
    if (res.status === 401) { auth.clearToken(); onUnauthorized?.(); throw new Error("Unauthorized"); }
    if (!res.ok) throw new Error(`POST background-image → ${res.status}`);
    return res.json();
  },

  deleteBackgroundImage: (pageId) => req("DELETE", `/pages/${pageId}/background-image`),

  // Sticky notes
  createStickyNote: (pageId, data) => req("POST", `/pages/${pageId}/sticky-notes`, data),
  updateStickyNote: (id, data)     => req("PUT",  `/sticky-notes/${id}`, data),
  deleteStickyNote: (id)           => req("DELETE", `/sticky-notes/${id}`),
};
