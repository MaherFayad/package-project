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
import { CookieNotice } from "../CookieNotice";
import { useInlineEditFocus } from "../useInlineEditFocus";
import { Stepper } from "../Stepper";
import { I18nProvider } from "@/i18n/client";
import { getDictionary } from "@/i18n";

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
  // ── Round 4 ──────────────────────────────────────────────────────────────
  it("the order stepper is a named group, not a navigation landmark without links (1.3.1)", () => {
    wrap(<Stepper accessibilityLabel="Progress" current={1} steps={[{ id: "a", label: "Placed" }, { id: "b", label: "Printing" }]} />);
    expect(screen.getByRole("group", { name: "Progress" })).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("dismissing a toast from the keyboard returns focus to where it came from (2.4.3)", () => {
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
    const opener = screen.getByText("fire");
    fireEvent.click(opener);
    opener.focus();
    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    dismiss.focus();
    fireEvent.click(dismiss);
    expect(document.activeElement).toBe(opener);
  });

  it("the cookie banner landmark is not named like the cookie policy page (1.3.1 landmark-unique)", () => {
    for (const locale of ["en", "ar"] as const) {
      const dict = getDictionary(locale);
      const { unmount } = render(
        <I18nProvider locale={locale} dict={dict}>
          <h1>{(dict as unknown as { store: { cookie: { label: string } } }).store.cookie.label}</h1>
          <CookieNotice />
        </I18nProvider>,
      );
      const region = screen.getByRole("region");
      expect(region.getAttribute("aria-label")).not.toBe(screen.getByRole("heading", { level: 1 }).textContent);
      unmount();
    }
  });

  it("a control focused under the cookie banner is scrolled clear of it (2.4.11)", () => {
    const dict = getDictionary("en");
    render(
      <I18nProvider locale="en" dict={dict}>
        <input aria-label="Other quantity" />
        <CookieNotice />
      </I18nProvider>,
    );
    const banner = screen.getByRole("region");
    const field = screen.getByLabelText("Other quantity");
    const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 390, width: 390, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    banner.getBoundingClientRect = () => rect(655, 750);
    field.getBoundingClientRect = () => rect(656, 688);
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
    field.focus();
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ top: 688 - 655 + 16 }));
    // A pointer press never scrolls mid-click (it would move the target away from the pointer).
    field.blur();
    scrollBy.mockClear();
    fireEvent.pointerDown(field);
    field.focus();
    fireEvent.pointerUp(field);
    expect(scrollBy).not.toHaveBeenCalled();
  });
  it("keyboard focus on a clipped chip in a horizontal scroller scrolls it fully into view, pointer focus does not (2.4.7, 2.4.11)", () => {
    render(
      <AppProvider locale="en">
        <div data-testid="row" style={{ overflowX: "auto" }}>
          <button type="button">First</button>
          <button type="button">Clipped</button>
        </div>
      </AppProvider>,
    );
    const row = screen.getByTestId("row");
    const chip = screen.getByRole("button", { name: "Clipped" });
    const rect = (left: number, right: number) => ({ left, right, top: 0, bottom: 40, width: right - left, height: 40, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
    Object.defineProperty(row, "scrollWidth", { value: 900 });
    Object.defineProperty(row, "clientWidth", { value: 320 });
    row.getBoundingClientRect = () => rect(0, 320);
    chip.getBoundingClientRect = () => rect(260, 420);
    const scroll = vi.fn();
    chip.scrollIntoView = scroll;
    chip.focus();
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ inline: "nearest", block: "nearest" }));
    chip.blur();
    scroll.mockClear();
    fireEvent.pointerDown(chip);
    chip.focus();
    fireEvent.pointerUp(chip);
    expect(scroll).not.toHaveBeenCalled();
  });
  it("a button disabled while it has focus keeps focus as aria-disabled and ignores clicks (2.4.3)", () => {
    const onClick = vi.fn();
    function Form() {
      const [note, setNote] = useState("x");
      return (
        <Button submit disabled={!note} onClick={() => (onClick(), setNote(""))}>
          Post
        </Button>
      );
    }
    wrap(<Form />);
    const btn = screen.getByRole("button", { name: "Post" });
    act(() => btn.focus());
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(btn);
    expect(btn.hasAttribute("disabled")).toBe(false);
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    act(() => btn.blur());
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("an inline Edit → form swap moves focus into the form and back to Edit on cancel (2.4.3)", () => {
    function Inline() {
      const [open, setOpen] = useState(false);
      const { containerRef, openerRef } = useInlineEditFocus(open);
      return !open ? (
        <Button ref={openerRef} onClick={() => setOpen(true)}>
          Edit
        </Button>
      ) : (
        <form ref={containerRef}>
          <input aria-label="Price" />
          <button type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </form>
      );
    }
    wrap(<Inline />);
    const edit = screen.getByRole("button", { name: "Edit" });
    edit.focus();
    fireEvent.click(edit);
    expect(document.activeElement).toBe(screen.getByLabelText("Price"));
    const cancel = screen.getByRole("button", { name: "Cancel" });
    cancel.focus();
    fireEvent.click(cancel);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit" }));
  });
});

describe("Round 6 kit contracts", () => {
  it("spinbutton fields speak the unit with the value, and accept extra describedby ids (1.3.1, 3.3.1)", () => {
    render(
      <AppProvider locale="en">
        <p id="grp-err">Each value is a number from 0 to 100.</p>
        <TextField label="Length" autoComplete="off" value="250" suffix="mm" spinbutton={{ now: 250, min: 80, max: 600, onStep: () => {} }} />
        <TextField label="C" autoComplete="off" value="150" error ariaDescribedBy="grp-err" />
      </AppProvider>,
    );
    expect(screen.getByRole("spinbutton", { name: "Length" }).getAttribute("aria-valuetext")).toBe("250 mm");
    const c = screen.getByRole("textbox", { name: "C" });
    expect(c.getAttribute("aria-invalid")).toBe("true");
    expect(c.getAttribute("aria-describedby")).toContain("grp-err");
  });

  it("contextual save bar keeps focus while saving and returns it to the edited field when it closes (2.4.3)", async () => {
    const rects = Element.prototype.getClientRects;
    Element.prototype.getClientRects = () => [{}] as unknown as DOMRectList;
    const { ContextualSaveBar } = await import("../Frame");
    function Form() {
      const [dirty, setDirty] = useState(true);
      const [saving, setSaving] = useState(false);
      return (
        <>
          <input aria-label="Bio" />
          {dirty ? (
            <ContextualSaveBar
              saveAction={{
                onAction: () => {
                  setSaving(true);
                  setTimeout(() => setDirty(false), 0);
                },
                loading: saving,
              }}
            />
          ) : null}
          <button type="button">After</button>
        </>
      );
    }
    render(
      <AppProvider locale="en">
        <Form />
      </AppProvider>,
    );
    screen.getByLabelText("Bio").focus();
    const save = screen.getByRole("button", { name: "Save" });
    save.focus();
    fireEvent.click(save);
    expect(save.getAttribute("aria-disabled")).toBe("true");
    expect((save as HTMLButtonElement).disabled).toBe(false);
    expect(document.activeElement).toBe(save);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    await new Promise((r) => setTimeout(r, 60));
    expect(document.activeElement).toBe(screen.getByLabelText("Bio"));
    Element.prototype.getClientRects = rects;
  });
});
