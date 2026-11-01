import React, { useCallback, useEffect, useState } from "react";
import * as api from "./api.js";
import Banner from "./components/Banner.jsx";
import Audit from "./pages/Audit.jsx";
import Connections from "./pages/Connections.jsx";
import Diagram from "./pages/Diagram.jsx";
import McpFirst from "./pages/McpFirst.jsx";
import Raw from "./pages/Raw.jsx";
import Stories from "./pages/Stories.jsx";
import Tool from "./pages/Tool.jsx";
import Tools from "./pages/Tools.jsx";
import { isMockConn } from "./lib/format.js";
import { PresentBar, PresentProvider, PresentToggle } from "./present/Present.jsx";

const NAV = [["connections", "Connections"], ["tools", "Tools"], ["raw", "Raw JSON-RPC"], ["audit", "Audit"], ["mcp-first", "MCP first"], ["stories", "Stories"], ["diagram", "Diagram"]];
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* not remembered */ } },
};
const parseHash = () => { const [, page = "connections", rest = ""] = window.location.hash.replace(/^#/, "").split("/"); return { page, rest: decodeURIComponent(rest) }; };

export default function App() {
  return <PresentProvider><Shell /></PresentProvider>;
}

function Shell() {
  const [route, setRoute] = useState(parseHash);
  const [conns, setConns] = useState([]);
  const [activeId, setActiveId] = useState(() => store.get("p1mcp.active"));
  const [tests, setTests] = useState({});
  const [testBusy, setTestBusy] = useState(null);
  const [ts, setTs] = useState({ id: null, tools: null, loading: false, error: "" });
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(Date.now());
  const [theme, setTheme] = useState(() => store.get("p1mcp.theme") || "system");
  const [info, setInfo] = useState(null); // GET /api/info; null = not known yet
  const [mode, setModeState] = useState("mock");
  const [refusal, setRefusal] = useState("");
  const [epoch, setEpoch] = useState(0); // bumped by Reset: remounts the page, so the diagram boxes and form fields start over
  const say = useCallback((m) => setMsg(m), []);
  const liveOk = Boolean(info?.live?.available);
  // The header toggle. Live is refused unless the server says every guard passes; the page then stays in Mock and says why.
  const setMode = (m) => {
    if (m === "live" && !liveOk) {
      const why = info?.live?.needs?.length ? info.live.needs.join(" ") : "The server did not say Live is available.";
      setRefusal(`Live is refused${info?.live?.failed?.length ? ` (${info.live.failed.join(", ")})` : ""}. ${why} Nothing was sent; the page stays in Mock.`);
      return;
    }
    setRefusal(""); setModeState(m);
  };

  useEffect(() => {
    api.get("/api/info").then((r) => {
      const i = r.ok ? r.json : { live: { available: false, failed: ["unreachable"], needs: [] } };
      setInfo(i); // the page always opens in Mock: Live is entered with the header toggle, never restored
    });
  }, []);
  useEffect(() => { const f = () => setRoute(parseHash()); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  useEffect(() => { if (theme === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme; store.set("p1mcp.theme", theme); }, [theme]);

  const reload = useCallback(async () => { const r = await api.get("/api/connections"); if (r.ok) setConns(r.json.connections); return r.ok ? r.json.connections : []; }, []);
  const select = useCallback((id) => { setActiveId(id); store.set("p1mcp.active", id); }, []);
  // The mode decides which saved connections the page works with: Mock uses the in-process mock demo, Live uses the real servers.
  const modeConns = conns.filter((c) => (mode === "mock") === isMockConn(c));
  const active = modeConns.find((c) => c.id === activeId) || modeConns[0] || null;

  const runTest = useCallback(async (id) => {
    setTestBusy(id); say("Testing the connection…");
    const r = await api.post(`/api/connections/${id}/test`);
    const t = r.ok ? r.json : { ok: false, error: r.json?.error || "error", message: r.status === 401 ? "Sign in first (interactive connection)." : r.json?.message || "The test failed." };
    setTests((x) => ({ ...x, [id]: t }));
    setTestBusy(null);
    say(t.ok ? `Connected: ${t.toolCount} tools.` : `Connection check failed: ${t.message}`);
    setTs((s) => (s.id === id ? { id: null, tools: null, loading: false, error: "" } : s));
    reload();
  }, [reload, say]);

  const loadTools = useCallback(async (id) => {
    setTs({ id, tools: null, loading: true, error: "" });
    const r = await api.get(`/api/connections/${id}/tools`);
    setTs({ id, tools: r.ok ? r.json.tools : [], loading: false, error: r.ok ? "" : r.status === 401 ? "Sign in first (interactive connection)." : r.json?.message || "Could not list tools." });
  }, []);

  // First load, and the return from PingOne's authorization server (?login=ok&connection=...).
  useEffect(() => {
    (async () => {
      const list = await reload();
      const q = new URLSearchParams(window.location.search);
      if (q.get("login")) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
        if (q.get("login") === "ok" && list.some((c) => c.id === q.get("connection"))) { select(q.get("connection")); say("Signed in."); runTest(q.get("connection")); }
        else say(`Sign-in failed (${q.get("reason") || "error"}). Nothing was stored.`);
      } else if (!list.some((c) => c.id === store.get("p1mcp.active"))) setActiveId(list[0]?.id ?? null);
      const want = q.get("connection") || (list.some((c) => c.id === store.get("p1mcp.active")) ? store.get("p1mcp.active") : list[0]?.id);
      const offline = list.find((c) => c.id === want && c.offline && c.auth === "worker");
      if (offline && !q.get("login")) runTest(offline.id); // the mock demo is safe to test on its own; a real server waits for the button
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Depends on the whole ts object, not its fields: a reset that lands in the same React batch as a finished load leaves ts.id at null before and after, and the list must still reload.
  useEffect(() => { if ((route.page === "tools" || route.page === "tool") && active && ts.id !== active.id && !ts.loading) loadTools(active.id); }, [route.page, active, ts, loadTools]);
  async function reset() {
    const r = await api.post("/api/reset");
    setEpoch((n) => n + 1); setTests({}); setTs({ id: null, tools: null, loading: false, error: "" });
    await reload();
    say(r.ok ? "Reset: audit history, tokens and the mock tenant cleared, writes turned off, diagram restored. Saved connections kept." : "Reset failed: could not reach the server.");
  }
  const expiry = active?.auth_status?.expiresAt;
  useEffect(() => { if (!expiry) return undefined; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [expiry]);

  const page = (() => {
    switch (route.page) {
      case "tools": return <Tools conn={active} tools={ts.id === active?.id ? ts.tools : null} loading={ts.loading} error={ts.error} test={active && tests[active.id]} testBusy={testBusy === active?.id} now={now} />;
      case "tool": return <Tool conn={active} tools={ts.id === active?.id ? ts.tools : null} name={route.rest} />;
      case "raw": return <Raw conn={active} />;
      case "audit": return <Audit />;
      case "mcp-first": return <McpFirst />;
      case "stories": return <Stories />;
      case "diagram": return <Diagram theme={theme} />;
      default: return <Connections mode={mode} conns={modeConns} activeId={active?.id ?? null} onSelect={select} reload={reload} tests={tests} testBusy={testBusy} runTest={runTest} now={now} say={say} />;
    }
  })();

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      <header className="top">
        <Banner mode={mode} conn={active} />
        <div className="top__bar">
          <h1 className="top__title">PingOne MCP Inspector LAB</h1>
          <div className="top__tools">
            <div className="seg" role="group" aria-label="Mode">
              <button type="button" aria-pressed={mode === "mock"} onClick={() => setMode("mock")} data-testid="mode-mock">Mock</button>
              <button type="button" aria-pressed={mode === "live"} onClick={() => setMode("live")} data-testid="mode-live">Live</button>
            </div>
            <span className="chip" data-testid="mode">Mode: {mode}</span>
            <PresentToggle />
            <button type="button" onClick={reset} data-testid="reset">Reset session</button>
            <label className="theme">Theme
              <select value={theme} onChange={(e) => setTheme(e.target.value)}><option value="system">Auto</option><option value="light">Light</option><option value="dark">Dark</option></select>
            </label>
          </div>
        </div>
        {refusal && <p className="notice" data-state="bad" role="alert" data-testid="refusal">{refusal}</p>}
        <nav className="top__nav" aria-label="Pages">
          {NAV.map(([id, label]) => <a key={id} className="top__link" href={`#/${id}`} aria-current={route.page === id || (id === "tools" && route.page === "tool") ? "page" : undefined}>{label}</a>)}
        </nav>
      </header>
      <PresentBar />
      <main id="main" tabIndex={-1} key={epoch}>{page}</main>
      <p className="visually-hidden" role="status" aria-live="polite" data-testid="live">{msg}</p>
      <footer className="foot">No accounts here: this app runs on your machine and holds your connections. UNVERIFIED claims are marked as such; see docs/references.md and docs/live-checks.md.</footer>
    </>
  );
}
