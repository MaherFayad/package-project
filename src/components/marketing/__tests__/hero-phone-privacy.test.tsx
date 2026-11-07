// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { HeroPhoneForm } from "../HeroPhoneForm";

afterEach(cleanup);

/** Security R5-SEC-05: the mobile number typed in the hero form never goes into a URL. */
describe("HeroPhoneForm", () => {
  it("sends a valid number to sign-in without the number in the query string", () => {
    render(<HeroPhoneForm locale="en" designPath="/en/design" labels={{ label: "Mobile", placeholder: "010", submit: "Start", error: "Bad", fine: "" }} />);
    fireEvent.change(screen.getByLabelText("Mobile"), { target: { value: "010 1234 5678" } });
    fireEvent.submit(screen.getByRole("button", { name: "Start" }).closest("form")!);
    expect(push).toHaveBeenCalledTimes(1);
    const url = String(push.mock.calls[0][0]);
    expect(url.startsWith("/en/login?next=")).toBe(true);
    expect(url).not.toMatch(/phone|01012345678|1012345678/);
  });
});
