import React, { useCallback, useEffect, useState } from "react";
import fs from "node:fs";
import ShelfLink from "./components/ShelfLink.jsx";
import VerifyMark from "./components/VerifyMark.jsx";
// Opened from Customer Agent LAB (UC-LEARN2 routes here): strip + header Back only, nothing preselected.
import ReturnLink from "./return-link/ReturnLink.jsx";
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
import { PresentBar, PresentProvider, usePresent } from "./present/Present.jsx";
import TopMenu, { applyFontSize } from "./top-menu/TopMenu.jsx";
import TalkTrackDialog from "./talk-track/TalkTrackDialog.jsx";
import { STORIES, VERTICALS, verticalById } from "./story/stories.js";
import { fillAll } from "./story/fill.js";

const VERSION = (() => { try { return JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version || null; } catch { return null; } })();

const NAV = [["connections", "Connections"], ["tools", "Tools"], ["raw", "Raw JSON-RPC"], ["audit", "Audit"], ["mcp-first", "MCP first"], ["stories", "Stories"], ["diagram", "Diagram"]];
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* not remembered */ } },
};
const parseHash = () => { const raw = window.location.hash.replace(/^#/, ""); const [head, query = ""] = raw.split("?"); const [, page = "connections", rest = ""] = head.split("/"); return { page, rest: decodeURIComponent(rest), query: new URLSearchParams(query) }; };

export default function App() {
  return <PresentProvider><Shell /></PresentProvider>;
}

function Shell() {
  const { present, set: setPresent } = usePresent();
  const [fontStep, setFontStep] = useState(() => { const f = store.get("p1mcp.font"); return ["S", "M", "L"].includes(f) ? f : "M"; });
  useEffect(() => { applyFontSize(fontStep); store.set("p1mcp.font", fontStep); }, [fontStep]);
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
  const [talkOpen, setTalkOpen] = useState(false);
  const talk = STORIES.flatMap((s) => {
    const vertical = verticalById(store.get("p1mcp.story.vertical") || "generic") || VERTICALS[0];
    const filled = fillAll(s, vertical);
    return [
      { id: `${s.id}-goal`, title: `${s.id}: ${filled.title}`, say: `${filled.goal} Obstacle: ${filled.obstacle}` },
      ...filled.steps.map((st) => ({ id: `${s.id}-${st.n}`, title: `${s.id}.${st.n} ${st.title}`, say: st.say })),
    ];
  });
  const say = useCallback((m) => setMsg(m), []);
  const liveOk = Boolean(info?.live?.available);
  // The header toggle. Rule 19: the mode is server-side (POST /api/mode). Real is disabled with the server's reason
  // while the Live guards do not pass; a refused switch (409) is shown, and the page stays in Mock.
  const setMode = async (m) => {
    const target = m === "real" ? "live" : m;
    const source = target === "live" ? "real" : "mock";
    if (source === "real" && !liveOk) {
      const why = info?.live?.needs?.length ? info.live.needs.join(" ") : "The server did not say Live is available.";
      setRefusal(`Live is refused${info?.live?.failed?.length ? ` (${info.live.failed.join(", ")}). ${why} Nothing was sent; the page stays in Mock.` : ""} ${why}`.trim());
      return;
    }
    const r = await api.post("/api/mode", { source });
    if (!r.ok) { setRefusal(r.json?.message || "The mode switch was refused."); return; }
    setRefusal(""); setModeState(target);
  };

  useEffect(() => {
    api.get("/api/info").then((r) => {
      const i = r.ok ? r.json : { live: { available: false, failed: ["unreachable"], needs: [] } };
      setInfo(i);
      if (r.ok && i.source === "real") setModeState("live"); // the server's mode wins on load
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

  // Idea 1 + 2: the connection/tool switchers on the tool page navigate in place — switching
  // connection loads its tools first so the tool dropdown is populated for the new connection.
  const navigateTool = useCallback(async (connId, toolName) => {
    if (connId && connId !== activeId) {
      select(connId);
      if (ts.id !== connId) loadTools(connId);
    }
    if (toolName) window.location.hash = `#/tool/${encodeURIComponent(toolName)}`;
  }, [activeId, select, ts.id, loadTools]);

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
      case "tools": return <Tools conn={active} tools={ts.id === active?.id ? ts.tools : null} loading={ts.loading} error={ts.error} test={active && tests[active.id]} testBusy={testBusy === active?.id} now={now} onScenarioApply={(id) => { select(id); loadTools(id); }} say={say} />;
      case "tool": return <Tool conn={active} tools={ts.id === active?.id ? ts.tools : null} name={route.rest} onNavigate={navigateTool} allConnections={modeConns.map((c) => ({ id: c.id, label: c.label }))} />;
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
      <header className="shell-bar">
        <span className="shell-brand">
          <span className="shell-logo" aria-hidden="true">PM</span>
          <span className="shell-name">PingOne MCP Inspector LAB</span>
          <span className={`shell-badge${mode === "live" ? " shell-badge--real" : ""}`} data-testid="mode">Mode: {mode}</span>
        </span>
        <nav className="shell-nav" aria-label="Pages">
          {NAV.map(([id, label]) => <a key={id} href={`#/${id}`} aria-current={route.page === id || (id === "tools" && route.page === "tool") ? "page" : undefined}>{label}</a>)}
        </nav>
        <TopMenu
          mode={{ value: mode === "live" ? "real" : "mock", onChange: setMode, realAvailable: info ? liveOk : null, realHint: info?.live?.needs?.length ? `Live is refused (${(info.live.failed ?? []).join(", ")}). ${info.live.needs.join(" ")}` : undefined }}
          theme={{ value: theme, onChange: setTheme }}
          fontSize={{ value: fontStep, onChange: setFontStep }}
          present={{ active: present, onToggle: () => setPresent(!present) }}
          talkTrack={{ active: talkOpen, onToggle: () => setTalkOpen((v) => !v) }}
          shelfUrl="https://local.ping-devops.com:8443/"
          help={{ href: "https://github.com/curtismu7/pingone-mcp-inspector-LAB#readme" }}
          version={VERSION}
          onReset={reset}
        >
          <ReturnLink app="pingone-mcp-inspector" variant="header" />
          <ShelfLink />
          <VerifyMark id="pingone-mcp-inspector" />
        </TopMenu>
      </header>
      <PresentBar />
      <main id="main" tabIndex={-1} key={epoch}>
        <Banner mode={mode} conn={active} />
        <ReturnLink app="pingone-mcp-inspector" />
        {refusal && <p className="notice" data-state="bad" role="alert" data-testid="refusal">{refusal}</p>}
        {page}
      </main>
      <p className="visually-hidden" role="status" aria-live="polite" data-testid="live">{msg}</p>
      <TalkTrackDialog isOpen={talkOpen} onClose={() => setTalkOpen(false)} talk={talk} />
      <footer className="foot">No accounts here: this app runs on your machine and holds your connections. UNVERIFIED claims are marked as such; see docs/references.md and docs/live-checks.md.</footer>
    </>
  );
}
