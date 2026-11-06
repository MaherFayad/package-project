import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { cleanup, createUser, signInAs, track } from "./fixtures/factory";

/**
 * Accessibility regressions (docs/audit/a11y.md): keyboard-only checkout and payment (focus is
 * never dropped to <body> between steps, WCAG 2.4.3 / X-01), the designer's modal focus trap
 * (2.1.2, 2.4.3) and axe (WCAG 2.2 AA tags) on each checkout step.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function axeClean(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName ?? "", id: el?.id ?? "" };
  });

/** Focus a control and activate it with the keyboard only. */
async function press(page: Page, locator: ReturnType<Page["getByRole"]>, key = "Enter") {
  await locator.focus();
  await page.keyboard.press(key);
}

const doc = {
  v: 1,
  name: "A11y mailer",
  structureCode: "FEFCO_0427",
  dims: { L: 250, W: 180, H: 80 },
  materialCode: "E_FLUTE_KRAFT",
  finishCode: "MATTE_LAMINATION",
  printSides: "OUTSIDE",
  artwork: { outside: { background: "#f4e9d8", layers: [] }, inside: { background: null, layers: [] } },
};

test.afterAll(cleanup);

test("keyboard-only checkout keeps focus on every step and reaches the card field (X-01)", async ({ page, baseURL }) => {
  test.setTimeout(150_000);
  const user = track(await createUser({ name: "A11y Buyer" }));
  await signInAs(page.context(), baseURL!, user.id);
  const res = await page.request.post("/api/designs", { data: { doc } });
  expect(res.status()).toBe(201);
  const { id: designId } = (await res.json()) as { id: string };

  await page.goto(`/en/checkout/${designId}`);
  await expect(page.getByTestId("vendor-offer").first()).toBeVisible();
  await axeClean(page);
  const summary = page.getByRole("complementary").filter({ hasText: "Summary" });

  // Step 1 → 2: focus moves into the delivery step, not to <body>.
  await press(page, summary.getByRole("button", { name: "Continue" }));
  await expect(page.getByLabel("Full name")).toBeVisible();
  expect((await focused(page)).tag).not.toBe("BODY");
  await axeClean(page);

  // Missing fields: focus goes to the first invalid field (3.3.1). The name is prefilled from the
  // account, so clear it to make it the first invalid one.
  await page.getByLabel("Full name").fill("");
  await press(page, summary.getByRole("button", { name: "Continue" }));
  await expect(page.getByLabel("Full name")).toBeFocused();
  await expect(page.getByLabel("Full name")).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel("Full name").fill("Mona Adel");
  await page.getByLabel("Mobile number").fill("010 1234 5678");
  await page.getByLabel("Governorate").selectOption("Giza");
  await page.getByLabel("City or district").fill("Dokki");
  await page.getByLabel("Street address").fill("12 Tahrir St");
  // The governorate re-prices delivery; Continue is busy until that lands.
  await expect(page.getByText("Delivery price updated for Giza.")).toBeVisible();
  await press(page, summary.getByRole("button", { name: "Continue" }));

  // Step 3: proof approval, keyboard only.
  const approve = summary.getByRole("button", { name: "Approve proof and pay" });
  await expect(approve).toBeVisible();
  expect((await focused(page)).tag).not.toBe("BODY");
  await axeClean(page);
  await press(page, approve);
  await expect(page.getByText("Tick the box to approve the proof.")).toBeVisible();
  await press(page, page.getByLabel("I approve this proof for printing"), "Space");
  await press(page, approve);

  // Payment: Continue on the method list moves focus to the card number (X-01).
  await expect(page).toHaveURL(/\/en\/checkout\/pay\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Payment" })).toBeVisible();
  await expect(page).toHaveTitle(/Payment/);
  await axeClean(page);
  await press(page, page.getByRole("button", { name: "Continue" }));
  await expect(page.getByLabel("Card number")).toBeFocused();

  // A declined card: focus stays in the card field and the error is tied to it (3.3.1).
  await page.keyboard.type("4000 0000 0000 0002");
  await press(page, page.getByRole("button", { name: /^Pay / }));
  await expect(page.getByLabel("Card number")).toBeFocused({ timeout: 15_000 });
  await expect(page.getByLabel("Card number")).toHaveAttribute("aria-invalid", "true");
  await axeClean(page);
});

test("designer dialogs trap focus, close on Escape and return focus (2.1.2, 2.4.3)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  await page.goto("/en/design/mailer-box");
  const opener = page.getByRole("button", { name: "Change model" });
  await expect(opener).toBeVisible();
  await press(page, opener);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press(i % 5 === 4 ? "Shift+Tab" : "Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener, `page errors: ${errors.join(" | ")}`).toBeFocused();
});
