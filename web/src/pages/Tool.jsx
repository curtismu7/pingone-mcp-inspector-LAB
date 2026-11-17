import React, { useEffect, useMemo, useState } from "react";
import * as api from "../api.js";
import CallView from "../components/CallView.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { useGatedCall } from "../components/useGatedCall.js";
import { classWhy, pretty, warnArgs } from "../lib/format.js";
import { examplesFor, tryItDefaults } from "../lib/examples.js";
import { Untrusted } from "../lib/Untrusted.jsx";
import { usePresent } from "../present/Present.jsx";
import StoryPanel from "../story/StoryPanel.jsx";
import { ClassBadge } from "./Tools.jsx";

const show = (v) => (typeof v === "string" ? v : v === undefined ? "" : JSON.stringify(v));
function coerce(type, text) {
  if (text === "") return undefined;
  if (type === "number" || type === "integer") { const n = Number(text); return Number.isNaN(n) ? text : n; }
  if (type === "object" || type === "array") { try { return JSON.parse(text); } catch { return text; } }
  return text;
}

function Fields({ schema, args, setArgs }) {
  const props = schema?.properties || {};
  const names = [...Object.keys(props), ...Object.keys(args).filter((k) => !(k in props))];
  const required = new Set(schema?.required || []);
  const put = (k, v) => setArgs((a) => { const n = { ...a }; if (v === undefined) delete n[k]; else n[k] = v; return n; });
  if (!names.length) return <p>This tool takes no parameters.</p>;
  return names.map((k) => {
    const p = props[k]; const type = p?.type;
    const label = <>{k}{required.has(k) && <abbr title="required"> *</abbr>}{!p && <span className="badge badge--lock">not in schema</span>}</>;
    const hint = p?.description && <small><Untrusted text={p.description} /></small>;
    // Idea 4: click-to-fill example chips under a field that has curated examples. The chips
    // are suggestions only — the value lands in the form where the user can edit it, and the
    // exact wire JSON below always shows what will be sent.
    const examples = examplesFor(k);
    const chips = examples.length > 0 && (
      <span className="ex-chips" role="group" aria-label="Suggested values">
        {examples.map((e) => (
          <button key={String(e)} type="button" className="ex-chip" onClick={() => put(k, typeof e === "string" && type !== "string" ? coerce(type, e) : e)}>
            {String(e)}
          </button>
        ))}
      </span>
    );
    if (p?.enum) return <label className="field" key={k}>{label}<select value={show(args[k])} onChange={(e) => put(k, e.target.value || undefined)}><option value="">(unset)</option>{p.enum.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}</select>{chips}{hint}</label>;
    if (type === "boolean") return <label className="field" key={k}>{label}<select value={args[k] === undefined ? "" : String(args[k])} onChange={(e) => put(k, e.target.value === "" ? undefined : e.target.value === "true")}><option value="">(unset)</option><option value="true">true</option><option value="false">false</option></select>{chips}{hint}</label>;
    if (type === "object" || type === "array") return <label className="field" key={k}>{label} (JSON)<textarea rows={3} value={typeof args[k] === "string" ? args[k] : args[k] === undefined ? "" : pretty(args[k])} onChange={(e) => put(k, coerce(type, e.target.value))} spellCheck="false" />{chips}{hint}</label>;
    return <label className="field" key={k}>{label}<input type={type === "number" || type === "integer" ? "number" : "text"} value={show(args[k])} onChange={(e) => put(k, coerce(type, e.target.value))} spellCheck="false" autoComplete="off" />{chips}{hint}</label>;
  });
}

// Idea 2: the tool dropdown groups by safety class with the class visible on the option text,
// so picking a write or destructive tool from the switcher is an informed choice, not a surprise.
function groupLabel(t) { return `${t.class === "read" ? "read" : t.class === "write" ? "write" : "destructive"} — ${t.name}`; }

export default function Tool({ conn, tools, name, onNavigate, allConnections }) {
  const tool = (tools || []).find((t) => t.name === name);
  const { present } = usePresent();
  const [args, setArgs] = useState({});
  const [mode, setMode] = useState("form");
  const [text, setText] = useState("{}");
  const [parseErr, setParseErr] = useState("");
  const [copied, setCopied] = useState("");
  const g = useGatedCall();
  // Idea 3 + 5: pre-fill from the "Try it" deep link AND from what the connection itself can
  // answer (idea 3: environmentId for a PingOne connection). The defaults apply on both paths —
  // a plain link and ?try=1 behave the same — so the form is never empty for a known tool. The
  // user sees and edits everything before calling; nothing is sent that is not visible in the
  // wire view.
  const initial = useMemo(() => {
    const t = tool;
    const base = tryItDefaults(t?.name) || {};
    const fromConn = (conn?.kind === "pingone" && t?.inputSchema?.properties?.environmentId) ? { environmentId: conn.envId } : {};
    return { ...base, ...fromConn };
  }, [conn, tool]);
  useEffect(() => { setArgs(initial); setMode("form"); setCopied(""); g.clear(); }, [name, conn?.id, tool?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!conn) return <><h1>Tool</h1><p>Select a connection first.</p></>;
  if (!tool) return <><h1>Tool</h1><p>This identity does not see a tool called <Untrusted text={name} />. The list is gated by role. <a href="#/tools">Back to the tools</a></p></>;

  const current = () => { if (mode === "form") return args; try { const v = JSON.parse(text); if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("arguments must be a JSON object"); return v; } catch (e) { return e; } };
  const live = current();
  const warnings = live instanceof Error ? [] : warnArgs(tool.inputSchema, live);
  function toggle(next) {
    if (next === mode) return;
    if (next === "json") { setText(pretty(args)); setParseErr(""); setMode("json"); return; }
    const v = current();
    if (v instanceof Error) { setParseErr(`Fix the JSON before switching: ${v.message}`); return; }
    setArgs(v); setParseErr(""); setMode("form");
  }
  function call() {
    const a = current();
    if (a instanceof Error) { setParseErr(a.message); return; }
    setParseErr("");
    g.run((extra) => api.post(`/api/connections/${conn.id}/call`, { tool: tool.name, arguments: a, ...extra }), { jsonrpc: "2.0", method: "tools/call", params: { name: tool.name, arguments: a } });
  }
  // Idea 6: the recipe strip — copy the exact call as JSON-RPC or as a curl line, so what the
  // app just did is repeatable outside it. Both are built from the SAME object shown in the
  // wire view; the Authorization line is a placeholder, never a real token.
  const recipeRequest = () => ({ jsonrpc: "2.0", method: "tools/call", params: { name: tool.name, arguments: live instanceof Error ? {} : live } });
  async function copyText(kind) {
    let textToCopy;
    if (kind === "jsonrpc") textToCopy = JSON.stringify(recipeRequest(), null, 2);
    else textToCopy = `curl -sS -X POST "$MCP_URL" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '${JSON.stringify(recipeRequest())}'`;
    try { await navigator.clipboard.writeText(textToCopy); setCopied(kind); } catch { setCopied(""); }
  }
  const preFilled = initial && typeof initial === "object" ? Object.keys(initial).length : 0;
  return (
    <>
      <p><a href="#/tools">All tools</a></p>
      <h1><Untrusted text={tool.name} /> <ClassBadge t={tool} /></h1>
      <p className="meta"><Untrusted text={tool.description || "(no description)"} /></p>
      <p className="why">Classed <strong>{tool.class}</strong> {classWhy(tool)}.{tool.class !== "read" && (conn.allowWrites ? " Writes are on for this connection, so a call shows a confirm dialog first." : " Writes are off for this connection, so a call is blocked.")}</p>
      {/* Ideas 1 + 2: connection and tool switchers. Changing either navigates without losing
          the page; the tool dropdown groups by class so the safety of the selection is visible
          in the picker itself. */}
      <section className="card card--neutral" aria-labelledby="ctx-h">
        <h2 id="ctx-h">Context</h2>
        <div className="grid2">
          <label className="field">Connection
            <select value={conn.id} onChange={(e) => onNavigate?.(e.target.value, name)} data-testid="conn-switcher">
              {(allConnections || [{ id: conn.id, label: conn.label }]).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="field">Tool
            <select value={tool.name} onChange={(e) => onNavigate?.(conn.id, e.target.value)} data-testid="tool-switcher">
              {["read", "write", "destructive"].map((cls) => {
                const group = (tools || []).filter((t) => t.class === cls);
                if (!group.length) return null;
                return <optgroup key={cls} label={cls}>{group.map((t) => <option key={t.name} value={t.name}>{t.name}{t.class !== "read" ? ` (${t.class})` : ""}</option>)}</optgroup>;
              })}
            </select>
            <small>Grouped by safety class; the selected tool's class badge is above.</small>
          </label>
        </div>
      </section>
      <section className="card" aria-labelledby="form-h">
        <div className="row between wrap">
          <h2 id="form-h">Arguments</h2>
          <span className="seg" role="group" aria-label="Input mode">
            <button type="button" aria-pressed={mode === "form"} onClick={() => toggle("form")}>Form</button>
            <button type="button" aria-pressed={mode === "json"} onClick={() => toggle("json")}>JSON</button>
          </span>
        </div>
        {mode === "form"
          ? <Fields schema={tool.inputSchema} args={args} setArgs={setArgs} />
          : <label className="field">Arguments (JSON object)<textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} spellCheck="false" /></label>}
        {parseErr && <p className="err-text" role="alert">{parseErr}</p>}
        {warnings.length > 0 && <ul className="warns" data-testid="warnings">{warnings.map((w) => <li key={`${w.kind}${w.param}`}><strong>{w.kind === "missing" ? "Missing" : "Warning"}:</strong> {w.message}</li>)}</ul>}
        <button type="button" className="primary" onClick={call} disabled={g.busy}>{g.busy ? "Calling…" : "Call"}</button>
      </section>
      <CallView response={g.response} />
      {/* Idea 6: recipe strip. Shown after a call (or with the current args at any time), it
          names what ran and offers one-click copies. The token is always a $TOKEN placeholder. */}
      {(g.response || !g.busy) && (
        <section className="card card--neutral" aria-labelledby="recipe-h" data-testid="recipe-strip">
          <h2 id="recipe-h">This call, outside the app</h2>
          <p className="meta">Called <strong>{tool.name}</strong> on <strong>{conn.label}</strong>{preFilled > 0 ? <> · {preFilled} argument{preFilled === 1 ? "" : "s"} pre-filled from the connection or the suggested defaults</> : null}{warnings.length ? <> · {warnings.length} warning{warnings.length === 1 ? "" : "s"}</> : ""}.</p>
          <div className="row wrap">
            <button type="button" onClick={() => copyText("jsonrpc")} data-testid="copy-jsonrpc">{copied === "jsonrpc" ? "Copied ✓" : "Copy JSON-RPC"}</button>
            <button type="button" onClick={() => copyText("curl")} data-testid="copy-curl">{copied === "curl" ? "Copied ✓" : "Copy as curl"}</button>
          </div>
          <p className="hint">$MCP_URL and $TOKEN are placeholders — this app never puts a real token on the clipboard.</p>
        </section>
      )}
      {g.gate && <ConfirmDialog tool={tool.name} gate={g.gate} busy={g.busy} onConfirm={g.confirm} onCancel={g.cancel} />}
      <StoryPanel mode="gate" present={present} />
    </>
  );
}
