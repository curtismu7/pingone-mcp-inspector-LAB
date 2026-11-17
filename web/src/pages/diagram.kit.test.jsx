// Diagram.jsx is wired to the diagram kit (web/src/diagram-kit): labels above the boxes, and a box that expands to show its details.
// React Flow does not render edges in jsdom, so the arrow drawing itself is proved in a real browser; here: what the page hands the kit.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Diagram from "./Diagram.jsx";
import { fakeApi } from "../test-helpers.js";
import { PresentProvider } from "../present/Present.jsx";

// React Flow fits the view on a short timer; let it finish before the page is torn down, or it fires into a closed window.
afterEach(async () => { await act(async () => { await new Promise((r) => setTimeout(r, 120)); }); cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
beforeEach(() => { window.history.replaceState(null, "", "/"); });

// The real diagram data, through the same fake the page's own tests use (web/src/test-helpers.js).
const mount = () => { fakeApi({}); return render(<PresentProvider><Diagram theme="light" /></PresentProvider>); };
const node = (text) => screen.getByText(text);
const open = () => [...document.querySelectorAll(".fbox.dk-open")].length;

describe("arrow labels", () => {
  it("are drawn once per edge, in the kit's layer above the boxes, and none is left as an SVG edge label", async () => {
    mount(); await screen.findByText("This app (server)");
    for (const [i, text] of [[0, "request"], [1, "request token"]]) {
      const l = screen.getByTestId(`dk-label-e${i}`); expect(l).toHaveTextContent(text); expect(document.querySelector(".react-flow__viewport-portal").contains(l)).toBe(true);
    }
    expect(document.querySelectorAll(".react-flow__edge-text").length).toBe(0); // no SVG label left under the boxes
  });
  it("Simulate marks the walked arrow's label and raises it; the other arrows' labels are dimmed", async () => {
    mount();
    expect(await screen.findByText("This app (server)")).toBeInTheDocument();
    expect(document.querySelectorAll(".dk-label--on, .dk-label--dim").length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Simulate" }));
    expect(document.querySelectorAll(".dk-label--on").length).toBe(1);
    expect(screen.getByTestId("dk-label-e0").className).toContain("dk-label--on"); expect(screen.getByTestId("dk-label-e0").style.zIndex).toBe("3");
    expect(screen.getByTestId("dk-label-e1").className).toContain("dk-label--dim");
  });
});

describe("a box expands in place", () => {
  it("clicking a box shows its details inside it: group, reach and both lists of arrows with their labels", async () => {
    mount();
    expect(await screen.findByText("This app (server)")).toBeInTheDocument();
    expect(open()).toBe(0);
    fireEvent.click(node("This app (server)").closest(".react-flow__node"));
    expect(document.querySelectorAll(".fbox.dk-open").length).toBe(1);
    const p = screen.getByTestId("dk-passport-app");
    expect(screen.getByTestId("dk-passport-reach")).toHaveTextContent("Upstream 2 · Downstream 3");
    expect(screen.getByTestId("dk-passport-outgoing")).toHaveTextContent("Outgoing · 2"); expect(screen.getByTestId("dk-passport-outgoing")).toHaveTextContent("tools/list, tools/call + Bearer");
    expect(screen.getByTestId("dk-passport-incoming")).toHaveTextContent("Incoming · 2"); expect(screen.getByTestId("dk-passport-incoming")).toHaveTextContent("request");
    expect(screen.queryByTestId("dk-passport-sources")).toBeNull(); // a diagram document has no code pointers
  });
  it("clicking the open box again collapses it, and the empty canvas collapses it", async () => {
    mount();
    await screen.findByText("This app (server)");
    fireEvent.click(node("This app (server)").closest(".react-flow__node")); expect(document.querySelectorAll(".fbox.dk-open").length).toBe(1);
    fireEvent.click(node("This app (server)").closest(".react-flow__node")); expect(document.querySelectorAll(".fbox.dk-open").length).toBe(0);
    fireEvent.click(node("This app (server)").closest(".react-flow__node"));
    fireEvent.click(document.querySelector(".react-flow__pane")); expect(document.querySelectorAll(".fbox.dk-open").length).toBe(0);
  });
  it("an item opens the box at the other end, Close collapses, and the page's Reset collapses it", async () => {
    mount();
    await screen.findByText("This app (server)");
    fireEvent.click(node("This app (server)").closest(".react-flow__node"));
    fireEvent.click(screen.getByTestId("dk-passport-outgoing").querySelector("button.dk-passport-go")); // by class: jsdom never measures nodes, so React Flow keeps them visibility:hidden
    expect(screen.getByTestId("dk-passport-token")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("dk-passport-close")); expect(document.querySelectorAll(".fbox.dk-open").length).toBe(0);
    fireEvent.click(node("Your browser").closest(".react-flow__node")); expect(document.querySelectorAll(".fbox.dk-open").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Reset" })); expect(document.querySelectorAll(".fbox.dk-open").length).toBe(0);
  });
});

describe("a shared link", () => {
  it("?box=<id> opens the page with that box expanded; a box that is not in the diagram is ignored", async () => {
    window.history.replaceState(null, "", "/?box=app"); mount();
    await screen.findByText("This app (server)");
    expect(screen.getByTestId("dk-passport-app")).toBeInTheDocument();
    cleanup(); window.history.replaceState(null, "", "/?box=ghost"); mount();
    await screen.findByText("This app (server)");
    expect(document.querySelectorAll(".fbox.dk-open").length).toBe(0);
  });
  it("Copy link puts the page's address with ?box=<id> on the clipboard, keeping the rest of the address", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    window.history.replaceState(null, "", "/?model=x#diagram");
    mount(); await screen.findByText("This app (server)");
    fireEvent.click(node("Your browser").closest(".react-flow__node"));
    await act(async () => { fireEvent.click(screen.getByTestId("dk-passport-copy")); });
    const url = new URL(writeText.mock.calls[0][0]);
    expect(url.searchParams.get("box")).toBe("browser"); expect(url.searchParams.get("model")).toBe("x"); expect(url.hash).toBe("#diagram");
  });
});
