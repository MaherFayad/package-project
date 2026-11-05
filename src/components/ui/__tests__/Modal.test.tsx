// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "../AppProvider";
import { Button } from "../Button";
import { Modal } from "../Modal";
import { TextField } from "../TextField";

afterEach(cleanup);

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <AppProvider locale="en">
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Modal
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Sign in to save"
        primaryAction={{ content: "Continue", onAction: () => {} }}
        secondaryActions={[{ content: "Cancel", onAction: () => setOpen(false) }]}
      >
        <TextField label="Phone" autoComplete="tel" />
      </Modal>
    </AppProvider>
  );
}

function tab(shift = false) {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab", shiftKey: shift });
}

describe("Modal", () => {
  it("opens as a labelled modal dialog and moves focus inside", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
    const dialog = screen.getByRole("dialog", { name: "Sign in to save" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("traps Tab and Shift+Tab inside the dialog", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Close" });
    const primary = screen.getByRole("button", { name: "Continue" });

    // From the dialog container, Shift+Tab wraps to the last control.
    tab(true);
    expect(document.activeElement).toBe(primary);
    // From the last control, Tab wraps to the first (the × close button).
    tab();
    expect(document.activeElement).toBe(close);
    // From the first control, Shift+Tab wraps to the last.
    tab(true);
    expect(document.activeElement).toBe(primary);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("makes the rest of the page inert while open", () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(container.closest("[inert]") ?? container.hasAttribute("inert")).toBeTruthy();
  });

  it("closes on Escape and returns focus to the opener", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Open dialog" });
    opener.focus();
    fireEvent.click(opener);
    act(() => {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.body.querySelector("[inert]")).toBeNull();
  });

  it("uses Arabic labels under the Arabic locale", () => {
    render(
      <AppProvider locale="ar">
        <Modal open onClose={() => {}} title="تسجيل الدخول">
          <p>محتوى</p>
        </Modal>
      </AppProvider>,
    );
    expect(screen.getByRole("button", { name: "إغلاق" })).toBeTruthy();
  });
});
