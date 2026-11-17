import React, { useState } from "react";
import * as api from "../api.js";
import { usePresent } from "../present/Present.jsx";

// Idea 7: scenario presets — configure connection, demo role, tool and a story page in one
// pick. PRESENTER MODE ONLY (the dropdown renders nothing otherwise): it exists to set up a
// demo fast, not to replace doing the thing. Each preset names what it will change before it
// changes anything, and the story page it opens is where the narration lives.
const SCENARIOS = [
  {
    id: "viewer-short-list",
    label: "S01: viewer sees a short tool list",
    steps: [
      "Sets the mock demo's role to viewer",
      "Tests the connection (tool count drops)",
      "Opens the Tools list — read tools only",
      "Opens story S01 for the narration",
    ],
    role: "viewer",
    after: "#/tools",
    storyHash: "#/stories",
  },
  {
    id: "admin-write-gate",
    label: "S02: admin, a write call needs a second look",
    steps: [
      "Sets the mock demo's role to admin",
      "Enables writes for the connection",
      "Opens the createUser tool, values pre-filled",
      "Opens story S02 for the narration",
    ],
    role: "admin",
    writes: true,
    after: "#/tool/createUser",
    storyHash: "#/stories",
  },
];

export default function ScenarioPicker({ conns, onApply, say }) {
  const { present } = usePresent();
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState("");
  if (!present) return null; // presenter-only: the normal flow stays the taught flow
  const mockWorker = conns.find((c) => c.offline && c.auth === "worker");
  async function apply(id) {
    const s = SCENARIOS.find((x) => x.id === id);
    if (!s || !mockWorker) { say("Add the mock demo connection first (Connections page)."); return; }
    setBusy(true); setPicked(id);
    try {
      if (s.role) { const r = await api.post(`/api/connections/${mockWorker.id}/role`, { role: s.role }); if (!r.ok) { say(r.json?.message || "Could not set the role."); return; } }
      const ws = await api.post(`/api/connections/${mockWorker.id}/settings`, { allowWrites: !!s.writes });
      if (!ws.ok) { say(ws.json?.message || "Could not set writes."); return; }
      const t = await api.post(`/api/connections/${mockWorker.id}/test`);
      say(`Scenario ready: ${s.label}${t.ok ? ` (${t.json.toolCount} tools)` : ""}.`);
      onApply?.(mockWorker.id);
      window.location.hash = s.after;
    } finally { setBusy(false); setPicked(""); }
  }
  const current = SCENARIOS.find((x) => x.id === picked);
  return (
    <section className="card card--neutral" aria-labelledby="scen-h" data-testid="scenario-picker">
      <h2 id="scen-h">Scenario presets <span className="badge">presenter mode</span></h2>
      <p className="meta">One pick configures the mock demo (role, writes) and opens the right page. The narration lives on the Stories page. Everything it changes is listed before you pick — the normal Tools and Raw pages stay the taught flow.</p>
      <label className="field">Scenario
        <select value={picked} onChange={(e) => apply(e.target.value)} disabled={busy} data-testid="scenario-select">
          <option value="">{busy ? "Applying…" : "(pick a scenario)"}</option>
          {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      {current && (
        <ol className="meta">
          {current.steps.map((st) => <li key={st}>{st}</li>)}
        </ol>
      )}
    </section>
  );
}
