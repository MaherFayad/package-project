// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Plus } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "../AppProvider";
import { Button } from "../Button";
import { fileAccepted } from "../DropZone";
import { cx } from "../utils";

afterEach(cleanup);

const wrap = (ui: React.ReactNode) => render(<AppProvider locale="en">{ui}</AppProvider>);

describe("Button", () => {
  it("fires onClick and defaults to type=button", () => {
    const onClick = vi.fn();
    wrap(<Button onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.getAttribute("type")).toBe("button");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("submit buttons use type=submit", () => {
    wrap(<Button submit>Send</Button>);
    expect(screen.getByRole("button", { name: "Send" }).getAttribute("type")).toBe("submit");
  });

  it("disabled uses the native attribute and ignores clicks", () => {
    const onClick = vi.fn();
    wrap(
      <Button disabled onClick={onClick}>
        Done
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Done" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading is busy, aria-disabled, ignores clicks, keeps focus and its accessible name", () => {
    const onClick = vi.fn();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    wrap(
      <form onSubmit={onSubmit}>
        <Button variant="primary" loading submit onClick={onClick}>
          Pay now
        </Button>
      </form>,
    );
    const btn = screen.getByRole("button", { name: /Pay now/ }) as HTMLButtonElement;
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    // Not natively disabled, so focus is not dropped to <body> while the action runs (WCAG 2.4.3).
    btn.focus();
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("icon-only buttons take their name from accessibilityLabel", () => {
    wrap(<Button icon={Plus} accessibilityLabel="Add item" />);
    expect(screen.getByRole("button", { name: "Add item" })).toBeTruthy();
  });

  it("pressed and expanded states are exposed", () => {
    wrap(
      <>
        <Button pressed>Bold</Button>
        <Button ariaExpanded={false} disclosure>
          More actions
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "More actions" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("renders a link when given an external url, and a button when that link is disabled", () => {
    wrap(
      <Button url="https://example.com" external>
        Docs
      </Button>,
    );
    // The new-tab hint is part of the name (WCAG 3.2.5 advisory, G201).
    const link = screen.getByRole("link", { name: /^Docs\s*\(opens in a new tab\)$/ });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    cleanup();
    wrap(
      <Button url="https://example.com" disabled>
        Docs
      </Button>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect((screen.getByRole("button", { name: "Docs" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("helpers", () => {
  it("cx joins only non-empty strings", () => {
    expect(cx("a", false, undefined, "", 0, "b")).toBe("a b");
  });
  it("fileAccepted matches extensions, wildcards and exact types", () => {
    const png = new File(["x"], "logo.PNG", { type: "image/png" });
    const pdf = new File(["x"], "art.pdf", { type: "application/pdf" });
    expect(fileAccepted(png, "image/*")).toBe(true);
    expect(fileAccepted(pdf, "image/*")).toBe(false);
    expect(fileAccepted(pdf, ".pdf,.ai")).toBe(true);
    expect(fileAccepted(png, "image/svg+xml")).toBe(false);
    expect(fileAccepted(png)).toBe(true);
  });
});
