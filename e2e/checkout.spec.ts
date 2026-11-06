import { expect, test, type Page } from "@playwright/test";

/**
 * Checkout main flow (seeded vendors + rate cards):
 * sign up → save a design → quantity + printer → address → proof approval → mock card
 * (declined, then paid) → order tracking → print PDF (paid only) → invoice → Arabic RTL view.
 */

async function signIn(page: Page, lang: "en" | "ar" = "en") {
  const suffix = String(Date.now() % 100_000_000).padStart(8, "0");
  const prefix = test.info().project.name === "mobile" ? "015" : "011";
  await page.goto(`/${lang}/orders`);
  await expect(page).toHaveURL(new RegExp(`/${lang}/login\\?next=`));
  const send = page.getByRole("button", { name: "Send code" });
  // Re-fill until the form has hydrated and enabled the button.
  await expect(async () => {
    // Clear first: React ignores an input event whose value equals the hydrated DOM value.
    await page.getByLabel("Mobile number").fill("");
    await page.getByLabel("Mobile number").fill(`${prefix}${suffix}`);
    await expect(send).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 60_000 });
  await send.click();
  const banner = page.getByTestId("otp-dev-code");
  await expect(banner).toBeVisible();
  const code = (await banner.textContent())!.match(/\d{6}/)![0];
  await page.getByLabel("Verification code").fill(code);
  await page.getByLabel(/I agree to the Terms/).check();
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(new RegExp(`:\\d+/${lang}/orders$`));
}

const doc = {
  v: 1,
  name: "E2E mailer",
  structureCode: "FEFCO_0427",
  dims: { L: 250, W: 180, H: 80 },
  materialCode: "E_FLUTE_KRAFT",
  finishCode: "MATTE_LAMINATION",
  printSides: "OUTSIDE",
  artwork: {
    outside: {
      background: "#f4e9d8",
      layers: [
        {
          id: "t_e2e",
          kind: "text",
          face: "top",
          surface: "outside",
          x: 125,
          y: 90,
          width: 120,
          height: 14,
          rotation: 0,
          text: "E2E Candles",
          fontFamily: "Inter",
          fontSizePt: 28,
          fontWeight: 700,
          color: "#303030",
          align: "center",
          direction: "ltr",
        },
      ],
    },
    inside: { background: null, layers: [] },
  },
};

test("buyer checks out a saved design, pays by mock card and tracks the order", async ({ page }) => {
  test.setTimeout(150_000);
  await signIn(page);

  // A saved design owned by the new account.
  const res = await page.request.post("/api/designs", { data: { doc } });
  expect(res.status()).toBe(201);
  const { id: designId } = (await res.json()) as { id: string };

  // 1) Quantity + printer
  await page.goto(`/en/checkout/${designId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible();
  const offers = page.getByTestId("vendor-offer");
  await expect(offers.first()).toBeVisible();
  await expect(offers.first()).toContainText("Best match");
  await page.getByRole("radio", { name: /250 boxes/ }).check({ force: true });
  await expect(offers.first()).toBeVisible();
  await expect(page.getByTestId("checkout-total")).toContainText("EGP");
  const summary = page.getByRole("complementary").filter({ hasText: "Summary" });
  await summary.getByRole("button", { name: "Continue" }).click();

  // 2) Delivery
  await expect(page.getByLabel("Full name")).toBeVisible();
  await page.getByLabel("Full name").fill("Mona Adel");
  await page.getByLabel("Mobile number").fill("010 1234 5678");
  await page.getByLabel("Governorate").selectOption("Giza");
  await page.getByLabel("City or district").fill("Dokki");
  await page.getByLabel("Street address").fill("12 Tahrir St");
  await summary.getByRole("button", { name: "Continue" }).click();

  // 3) Proof review: approval is required
  await expect(page.getByRole("tab", { name: "3D proof" })).toBeVisible();
  await page.getByRole("tab", { name: "Flat proof" }).click();
  await expect(page.getByRole("figure", { name: /Flat dieline proof/ })).toBeVisible();
  const approve = summary.getByRole("button", { name: "Approve proof and pay" });
  await approve.click();
  await expect(page.getByText("Tick the box to approve the proof.")).toBeVisible();
  await page.getByLabel("I approve this proof for printing").check();
  await approve.click();

  // 4) Payment: a declined card, then a good one
  await expect(page).toHaveURL(/\/en\/checkout\/pay\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Payment" })).toBeVisible();
  await expect(page.getByTestId("pay-total")).toContainText("EGP");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Card number").fill("4000 0000 0000 0002");
  await page.getByRole("button", { name: /^Pay / }).click();
  await expect(page.getByText("Your card was declined.")).toBeVisible();
  // A declined card keeps the buyer on the card form with a fresh attempt (no restart).
  await expect(page.getByLabel("Card number")).toHaveValue("");
  await page.getByLabel("Card number").fill("4242 4242 4242 4242");
  await page.getByLabel("Expiry (MM/YY)").fill("12/30");
  await page.getByLabel("Security code").fill("123");
  await page.getByRole("button", { name: /^Pay / }).click();

  // 5) Order tracking
  await expect(page).toHaveURL(/\/en\/orders\/[^/?]+\?paid=1/, { timeout: 30_000 });
  await expect(page.getByText("Payment received. Your order is going to the printer.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Order ELB-\d+/);
  const progress = page.getByRole("navigation", { name: "Progress" });
  await expect(progress.locator('[aria-current="step"]')).toContainText("In production");
  await expect(page.getByText("Payment confirmed: Card (Meeza, Visa, Mastercard)")).toBeVisible();
  const orderUrl = page.url().split("?")[0];
  const orderId = orderUrl.split("/").pop()!;

  // Print-ready PDF exists only for the paid order.
  const pdf = await page.request.get(`/api/orders/${orderId}/print-pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Invoice with VAT 14%.
  await page.goto(`${orderUrl}/invoice`);
  await expect(page.getByText("VAT 14%", { exact: true })).toBeVisible();
  await expect(page.getByText("Pending submission")).toBeVisible();
  await expect(page.getByTestId("invoice-total")).toContainText("EGP");

  // Orders list shows it.
  await page.goto("/en/orders");
  await expect(page.getByRole("link", { name: /ELB-\d+/ }).first()).toBeVisible();

  // Arabic: RTL, no horizontal scroll.
  await page.goto(orderUrl.replace("/en/", "/ar/"));
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("الطلب");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("webhook rejects unsigned payment callbacks", async ({ request }) => {
  const res = await request.post("/api/payments/webhook?provider=mock", {
    data: { type: "payment.updated", paymentId: "x", providerRef: "y", status: "PAID", amountPiasters: 1, method: "CARD" },
  });
  expect(res.status()).toBe(401);
});

test("print PDF is not available without an account", async ({ request }) => {
  const res = await request.get("/api/orders/anything/print-pdf");
  expect(res.status()).toBe(401);
});
