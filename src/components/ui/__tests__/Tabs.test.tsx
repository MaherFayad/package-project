// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AppProvider } from "../AppProvider";
import { Tabs, type TabDescriptor } from "../Tabs";

afterEach(cleanup);

const TABS: TabDescriptor[] = [
  { id: "all", content: "All" },
  { id: "open", content: "Open" },
  { id: "archived", content: "Archived", disabled: true },
  { id: "drafts", content: "Drafts" },
];

function Harness({ locale = "en", activation }: { locale?: "en" | "ar"; activation?: "manual" }) {
  const [sel, setSel] = useState(0);
  return (
    <AppProvider locale={locale}>
      <Tabs tabs={TABS} selected={sel} onSelect={setSel} accessibilityLabel="Views" activation={activation}>
        <p>Panel {TABS[sel]!.id}</p>
      </Tabs>
    </AppProvider>
  );
}

const tab = (name: string) => screen.getByRole("tab", { name });

describe("Tabs", () => {
  it("exposes tablist/tab/tabpanel semantics with a single tab stop", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Views" })).toBeTruthy();
    expect(tab("All").getAttribute("aria-selected")).toBe("true");
    expect(tab("All").tabIndex).toBe(0);
    expect(tab("Open").tabIndex).toBe(-1);
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(tab("All").id);
    expect(tab("All").getAttribute("aria-controls")).toBe(panel.id);
  });

  it("ArrowRight/ArrowLeft move and select in LTR, skipping disabled tabs and wrapping", () => {
    render(<Harness />);
    tab("All").focus();
    fireEvent.keyDown(tab("All"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("Open"));
    expect(tab("Open").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Panel open")).toBeTruthy();

    fireEvent.keyDown(tab("Open"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("Drafts")); // skipped disabled "Archived"

    fireEvent.keyDown(tab("Drafts"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("All")); // wraps

    fireEvent.keyDown(tab("All"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tab("Drafts"));
  });

  it("Home and End jump to the first and last enabled tab", () => {
    render(<Harness />);
    tab("All").focus();
    fireEvent.keyDown(tab("All"), { key: "End" });
    expect(document.activeElement).toBe(tab("Drafts"));
    fireEvent.keyDown(tab("Drafts"), { key: "Home" });
    expect(document.activeElement).toBe(tab("All"));
  });

  it("follows reading direction in RTL (ArrowLeft goes forward)", () => {
    render(<Harness locale="ar" />);
    tab("All").focus();
    fireEvent.keyDown(tab("All"), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tab("Open"));
    fireEvent.keyDown(tab("Open"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("All"));
  });

  it("manual activation only moves focus until Enter", () => {
    render(<Harness activation="manual" />);
    tab("All").focus();
    fireEvent.keyDown(tab("All"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("Open"));
    expect(tab("All").getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tab("Open"), { key: "Enter" });
    expect(tab("Open").getAttribute("aria-selected")).toBe("true");
  });
});
