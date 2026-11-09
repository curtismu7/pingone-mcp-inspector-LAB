// The confirm gate's dialog is the shared FloatingDialog, and the vendored folder matches its pin.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("floating-dialog vendoring", () => {
  it("each vendored file is one header line naming the pinned commit plus the upstream file, matching floating-dialog.sha256", () => {
    const dir = path.join(process.cwd(), "src", "floating-dialog");
    const text = fs.readFileSync(path.join(dir, "floating-dialog.sha256"), "utf8");
    const commit = text.split("\n")[0].match(/^# vendored from curtismu7\/AI-DEMO-Standalone shared\/floating-dialog at ([0-9a-f]{7,40}) /)?.[1];
    expect(commit).toBeTruthy();
    const pins = text.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split(/\s+/));
    expect(pins.map(([, f]) => f).sort()).toEqual(["FloatingDialog.jsx", "floating-dialog.css", "floating-dialog.test.jsx", "geometry.js", "useFloatingPanel.js"]);
    for (const [h, f] of pins) {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const nl = raw.indexOf("\n");
      expect(raw.slice(0, nl), f).toContain(`Vendored from AI-DEMO-Standalone shared/floating-dialog @ ${commit}; edit there, not here.`);
      expect(createHash("sha256").update(raw.slice(nl + 1)).digest("hex"), f).toBe(h);
    }
  });
});

describe("ConfirmDialog", () => {
  const gate = { arguments: { username: "pat" }, argsHash: "abc123hash", requiresTypedName: false };

  it("renders in FloatingDialog: modal, drag handle, same accessible name and content", () => {
    render(<ConfirmDialog tool="createUser" gate={gate} onConfirm={() => {}} onCancel={() => {}} />);
    const dlg = screen.getByRole("dialog", { name: "Confirm a write: createUser" });
    expect(dlg).toHaveAttribute("data-testid", "confirm-dialog");
    expect(dlg).toHaveAttribute("aria-modal", "true");
    expect(within(dlg).getByTestId("fd-titlebar")).toBeInTheDocument();
    expect(within(dlg).getByTestId("confirm-args")).toHaveTextContent('"username": "pat"');
    expect(within(dlg).getByTestId("confirm-hash")).toHaveTextContent("abc123hash");
    expect(within(dlg).getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("Escape cancels once and confirms nothing; Confirm returns the typed name", async () => {
    const onCancel = vi.fn(); const onConfirm = vi.fn();
    render(<ConfirmDialog tool="deleteUser" gate={{ ...gate, requiresTypedName: true }} onConfirm={onConfirm} onCancel={onCancel} />);
    const dlg = screen.getByRole("dialog", { name: "Confirm a destructive call: deleteUser" });
    expect(within(dlg).getByLabelText(/Type/)).toHaveFocus();
    fireEvent.keyDown(dlg, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.setup().type(within(dlg).getByLabelText(/Type/), "deleteUser");
    fireEvent.click(within(dlg).getByRole("button", { name: /Delete: confirm/ }));
    expect(onConfirm).toHaveBeenCalledWith("deleteUser");
  });
});
