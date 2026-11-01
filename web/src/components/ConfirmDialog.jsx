import React, { useEffect, useRef, useState } from "react";
import { pretty } from "../lib/format.js";

// The confirm gate's second look: the exact arguments, their hash, and for a destructive call the tool name typed.
export default function ConfirmDialog({ tool, gate, onConfirm, onCancel, busy }) {
  const [typed, setTyped] = useState("");
  const first = useRef(null);
  useEffect(() => { first.current?.focus(); }, []);
  const needName = gate.requiresTypedName;
  const ready = !needName || typed === tool;
  const onKey = (e) => { if (e.key === "Escape") onCancel(); };
  return (
    <div className="modal-back" onKeyDown={onKey}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-h" aria-describedby="confirm-d">
        <h2 id="confirm-h">{needName ? "Confirm a destructive call" : "Confirm a write"}: {tool}</h2>
        <p id="confirm-d">These are the exact arguments that will be sent. If any argument changes, the hash changes and the call is refused.</p>
        <pre className="untrusted untrusted--block" data-testid="confirm-args">{pretty(gate.arguments)}</pre>
        <p>Arguments hash: <code data-testid="confirm-hash">{gate.argsHash}</code></p>
        {needName && (
          <label className="field">Type <code>{tool}</code> to confirm
            <input ref={first} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck="false" />
          </label>
        )}
        <div className="row">
          <button type="button" onClick={onCancel} ref={needName ? undefined : first}>Cancel</button>
          <button type="button" className="primary" disabled={!ready || busy} onClick={() => onConfirm(typed)}>{needName ? "Delete: confirm" : "Confirm and send"}</button>
        </div>
      </div>
    </div>
  );
}
