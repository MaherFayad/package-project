// @vitest-environment jsdom
/**
 * Accessibility contracts of the UI kit (round 2 a11y audit, docs/audit/a11y.md).
 * Each test names the WCAG 2.2 success criterion it protects.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Bell } from "lucide-react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionList } from "../ActionList";
import { AppProvider } from "../AppProvider";
import { CountBadge } from "../Badge";
import { Banner } from "../Banner";
import { Checkbox } from "../Checkbox";
import { DropZone } from "../DropZone";
import { TopBarIconButton } from "../Frame";
import { DataTable, IndexTable } from "../IndexTable";
import { Modal } from "../Modal";
import { Select } from "../Select";
import { TextField } from "../TextField";
import { ToastProvider, useToast } from "../Toast";
import { Tooltip } from "../Tooltip";
import { Button } from "../Button";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const wrap = (ui: React.ReactNode) => render(<AppProvider locale="en">{ui}</AppProvider>);

describe("UI kit accessibility contracts", () => {
  it("count badges keep a separator in the accessible name (1.3.1)", () => {
    wrap(
      <button type="button">
        Vendors
        <CountBadge>1</CountBadge>
      </button>,
    );
    expect(screen.getByRole("button").textContent).toBe("Vendors (1)");
  });

  it("top bar icon buttons include the visible count in their name (2.5.3)", () => {
    wrap(<TopBarIconButton icon={Bell} label="Notifications" badge={3} />);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-label")).toBeNull();
    expect(btn.textContent).toBe("Notifications (3)");
  });

  it("empty table headings fall back to a hidden 'Actions' name (1.3.1)", () => {
    wrap(
      <>
        <IndexTable resourceName={{ singular: "order", plural: "orders" }} headings={[{ title: "Order" }, { title: "" }]}>
          {null}
        </IndexTable>
        <DataTable caption="Prices" columnContentTypes={["text", "text"]} headings={["Quantity", ""]} rows={[["100", "x"]]} />
      </>,
    );
    const headers = screen.getAllByRole("columnheader");
    expect(headers.every((h) => (h.textContent ?? "").trim().length > 0)).toBe(true);
  });

  it("requiredIndicator is exposed programmatically, not only as a hidden asterisk (3.3.2)", () => {
    wrap(
      <>
        <TextField label="Company" autoComplete="organization" requiredIndicator />
        <Select label="City" options={["Cairo", "Giza"]} requiredIndicator />
      </>,
    );
    expect(screen.getByLabelText(/Company/).getAttribute("aria-required")).toBe("true");
    expect(screen.getByLabelText(/City/).getAttribute("aria-required")).toBe("true");
  });

  it("indeterminate checkboxes rely on the native state, not aria-checked (4.1.2)", () => {
    wrap(<Checkbox label="Select all" checked="indeterminate" />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    expect(box.hasAttribute("aria-checked")).toBe(false);
  });

  it("drop zones are a group named by their label (1.3.1, 2.4.6)", () => {
    wrap(<DropZone label="Artwork file" onDrop={() => {}} />);
    expect(screen.getByRole("group", { name: "Artwork file" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add files" })).toBeTruthy();
  });

  it("drop zones with custom content keep a keyboard path to the file picker (2.1.1)", () => {
    wrap(
      <DropZone label="Logo" onDrop={() => {}}>
        <span>logo.png</span>
      </DropZone>,
    );
    const input = screen.getByLabelText("Logo", { selector: "input" }) as HTMLInputElement;
    expect(input.tabIndex).toBe(0);
  });

  it("static banners carry no naming attributes on a generic div (4.1.2)", () => {
    const { container } = wrap(<Banner title="Heads up">Body</Banner>);
    expect(container.querySelector("[aria-labelledby]")).toBeNull();
  });

  it("menu items are a single tab stop and section groups are named (2.1.1, 1.3.1)", () => {
    wrap(
      <ActionList
        actionRole="menuitem"
        sections={[{ title: "Account", items: [{ content: "Profile" }, { content: "Sign out" }] }]}
      />,
    );
    const items = screen.getAllByRole("menuitem");
    expect(items.every((i) => i.tabIndex === -1)).toBe(true);
    expect(screen.getByRole("group", { name: "Account" })).toBeTruthy();
    items[0]!.focus();
    fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
  });

  it("a toast with an action does not time out (2.2.1)", () => {
    vi.useFakeTimers();
    function Fire() {
      const toast = useToast();
      return <button onClick={() => toast.show("Draft deleted", { action: { content: "Undo", onAction: () => {} } })}>fire</button>;
    }
    render(
      <AppProvider locale="en">
        <ToastProvider>
          <Fire />
        </ToastProvider>
      </AppProvider>,
    );
    fireEvent.click(screen.getByText("fire"));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
  });

  it("Escape on a tooltip inside a modal closes the tooltip only (1.4.13)", async () => {
    const onClose = vi.fn();
    function Harness() {
      const [open] = useState(true);
      return (
        <Modal open={open} onClose={onClose} title="Edit">
          <Tooltip content="More about pricing">
            <Button>Info</Button>
          </Tooltip>
        </Modal>
      );
    }
    wrap(<Harness />);
    const trigger = screen.getByRole("button", { name: "Info" });
    // Focus shows the tooltip on the next tick.
    await act(async () => {
      trigger.focus();
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(screen.getByRole("tooltip").className).not.toContain("visually-hidden");
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.getByRole("tooltip").className).toContain("visually-hidden");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
