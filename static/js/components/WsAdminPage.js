import { h } from "https://esm.sh/preact@10.19.3";
import { useState, useEffect, useCallback } from "https://esm.sh/preact@10.19.3/hooks";
import { api } from "../api.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtIdle(sec) {
  if (sec < 60)  return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

function fmtExpiry(sec) {
  if (sec <= 0) return "closing…";
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return h("button", { class: "ws-copy-btn", onClick: copy },
    copied ? "✓ Copied" : "Copy"
  );
}

// ── Section: Origins ──────────────────────────────────────────────────────────

function OriginsSection({ origins, onSave }) {
  const [items,   setItems]   = useState(origins);
  const [newUrl,  setNewUrl]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => { setItems(origins); }, [origins]);

  function add() {
    const url = newUrl.trim().replace(/\/$/, "");
    if (!url || items.includes(url)) { setNewUrl(""); return; }
    setItems([...items, url]);
    setNewUrl("");
  }

  function remove(u) { setItems(items.filter(i => i !== u)); }

  async function save() {
    setSaving(true);
    try {
      await onSave(items);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save origins:", e);
    } finally {
      setSaving(false);
    }
  }

  return h("div", { class: "ws-section" },
    h("h3", { class: "ws-section-title" }, "Allowed Origins"),
    h("p", { class: "ws-section-hint" },
      "Only WebSocket connections from these origins will be accepted. Leave empty to allow all origins (not recommended)."
    ),
    h("div", { class: "ws-origin-list" },
      items.length === 0
        ? h("div", { class: "ws-origin-empty" }, "No origins configured — all connections accepted")
        : items.map(u => h("div", { key: u, class: "ws-origin-row" },
            h("span", { class: "ws-origin-url" }, u),
            h("button", { class: "ws-origin-remove", onClick: () => remove(u), title: "Remove" }, "×")
          ))
    ),
    h("div", { class: "ws-origin-add" },
      h("input", {
        class: "ws-origin-input",
        type: "url",
        placeholder: "https://your-app.github.io",
        value: newUrl,
        onInput: e => setNewUrl(e.target.value),
        onKeyDown: e => e.key === "Enter" && add(),
      }),
      h("button", { class: "ws-btn-add", onClick: add }, "+ Add")
    ),
    h("button", {
      class: "ws-btn-save",
      onClick: save,
      disabled: saving,
    }, saving ? "Saving…" : saved ? "✓ Saved" : "Save changes")
  );
}

// ── Section: Rooms ────────────────────────────────────────────────────────────

function RoomsSection({ status, onRefresh, loading }) {
  return h("div", { class: "ws-section" },
    h("div", { class: "ws-section-header" },
      h("h3", { class: "ws-section-title" },
        "Active Rooms",
        h("span", { class: "ws-badge" }, status?.active_rooms ?? 0)
      ),
      h("button", { class: "ws-btn-refresh", onClick: onRefresh, disabled: loading },
        loading ? "…" : "↻ Refresh"
      )
    ),
    status?.active_rooms === 0
      ? h("div", { class: "ws-room-empty" }, "No active rooms")
      : h("div", { class: "ws-room-grid" },
          (status?.rooms ?? []).map(r =>
            h("div", { key: r.room_id, class: "ws-room-card" },
              h("div", { class: "ws-room-id" }, r.room_id.slice(0, 8) + "…"),
              h("div", { class: "ws-room-users" },
                r.users.length === 0
                  ? h("span", { class: "ws-chip gray" }, "empty")
                  : r.users.map(u => h("span", { key: u, class: "ws-chip blue" }, u))
              ),
              h("div", { class: "ws-room-meta" },
                h("span", null, `${r.connections}/2 connected`),
                h("span", { class: "ws-dot" }, "·"),
                h("span", null, `idle ${fmtIdle(r.idle_seconds)}`),
                h("span", { class: "ws-dot" }, "·"),
                h("span", { class: r.expires_in < 60 ? "ws-expiry-warn" : "" },
                  `closes in ${fmtExpiry(r.expires_in)}`)
              )
            )
          )
        )
  );
}

// ── Section: Sample code ──────────────────────────────────────────────────────

function SampleSection() {
  const wsBase = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;

  const sampleCode = `// ── Step 1: First user generates a room link ─────────────────
const roomId = crypto.randomUUID();
const link = \`\${location.origin}?room=\${roomId}\`;
// Share this link with the other person (e.g. copy + paste in chat)
navigator.clipboard.writeText(link);

// ── Step 2: Both users connect (run on page load) ─────────────
const room = new URLSearchParams(location.search).get("room");
if (!room) { /* show "generate link" UI */ }

const ws = new WebSocket(
  \`${wsBase}/ws?room=\${room}&user=Alice\`
  //                               ^^^^^ replace with actual username
);

ws.onopen  = () => console.log("Connected to room:", room);
ws.onclose = ({ code, reason }) => console.log("Closed:", code, reason);

ws.onmessage = ({ data }) => {
  const { type, payload, sender, ts } = JSON.parse(data);

  if (type === "user_joined") console.log(sender, "joined");
  if (type === "user_left")   console.log(payload.user, "left");
  if (type === "room_closed") console.log("Room closed:", payload.reason);

  // Handle your custom message types:
  if (type === "draw")   renderStroke(payload);
  if (type === "cursor") renderCursor(sender, payload);
};

// ── Step 3: Send messages ──────────────────────────────────────
ws.send(JSON.stringify({
  type: "draw",                    // any string you define
  payload: { x: 100, y: 200 },    // any value
}));

// ── Close codes ────────────────────────────────────────────────
// 4001 – Origin not in allowed list
// 4002 – Room ID expired or previously closed (no reuse)
// 4003 – Room already has 2 connections`;

  return h("div", { class: "ws-section" },
    h("h3", { class: "ws-section-title" }, "Sample Code"),
    h("p", { class: "ws-section-hint" },
      "WebSocket endpoint: ",
      h("code", { class: "ws-inline-code" }, `${wsBase}/ws`)
    ),
    h("div", { class: "ws-code-wrap" },
      h("div", { class: "ws-code-toolbar" },
        h("span", { class: "ws-code-lang" }, "JavaScript"),
        h(CopyBtn, { text: sampleCode })
      ),
      h("pre", { class: "ws-code" }, h("code", null, sampleCode))
    )
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

export function WsAdminPage({ onBack }) {
  const [origins,  setOrigins]  = useState([]);
  const [status,   setStatus]   = useState(null);
  const [loading,  setLoading]  = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, st] = await Promise.all([api.wsConfig(), api.wsStatus()]);
      setOrigins(cfg.allowed_origins ?? []);
      setStatus(st);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  // Auto-refresh rooms every 15s
  useEffect(() => {
    const t = setInterval(async () => {
      try { setStatus(await api.wsStatus()); } catch {}
    }, 15000);
    return () => clearInterval(t);
  }, []);

  async function saveOrigins(list) {
    const cfg = await api.wsConfigUpdate(list);
    setOrigins(cfg.allowed_origins ?? []);
  }

  return h("div", { class: "ws-admin" },
    h("div", { class: "list-topbar" },
      h("div", { class: "list-topbar-brand" },
        h("button", { class: "ws-back-btn", onClick: onBack },
          h("svg", { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 2 },
            h("path", { d: "M15 18l-6-6 6-6" })
          )
        ),
        h("span", { class: "list-topbar-name" }, "WebSocket Manager")
      ),
      h("div", { class: "list-topbar-right" },
        h("div", { class: `ws-status-dot ${status ? "online" : ""}` }),
        h("span", { class: "ws-status-label" },
          status ? `${status.total_connections} connection${status.total_connections !== 1 ? "s" : ""}` : "loading…"
        )
      )
    ),

    h("div", { class: "ws-body" },
      h(OriginsSection, { origins, onSave: saveOrigins }),
      h(RoomsSection,   { status, onRefresh: fetchAll, loading }),
      h(SampleSection),
    )
  );
}
