import { expect, test, type Page } from "@playwright/test";
import { sendOtp, uniquePhone, verifyNewAccount } from "./fixtures/factory";

/**
 * Checkout main flow (seeded vendors + rate cards):
 * sign up → save a design → quantity + printer → address → proof approval → mock card
 * (declined, then paid) → order tracking → print PDF (paid only) → invoice → Arabic RTL view.
 */

async function signIn(page: Page, lang: "en" | "ar" = "en") {
  // Unique per test and worker (OTP limits are per phone): e2e/fixtures/factory.ts.
  const phone = (await uniquePhone()).local;
  await page.goto(`/${lang}/orders`);
  await expect(page).toHaveURL(new RegExp(`/${lang}/login\\?next=`));
  const code = await sendOtp(page, phone);
  await verifyNewAccount(page, code);
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

  // 1) Quantity (Elba picks the printer; the other offers are behind "More options", R1-13)
  await page.goto(`/en/checkout/${designId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible();
  await expect(page.getByTestId("chosen-printer")).toContainText(/Printed by a vetted Elba printer/);
  await page.getByTestId("printer-options").locator("summary").click();
  const offers = page.getByTestId("vendor-offer");
  await expect(offers.first()).toBeVisible();
  await expect(offers.first()).toContainText("Best match");
  await page.getByRole("radio", { name: /250 boxes/ }).check({ force: true });
  await expect(page.getByTestId("chosen-printer")).toBeVisible();
  await expect(page.getByTestId("checkout-total")).toContainText("EGP");
  const summary = page.getByRole("complementary").filter({ hasText: "Your order" });
  await summary.getByRole("button", { name: "Continue to address" }).click();

  // 2) Address and approval on one step (a new account has no remembered address)
  await expect(page.getByLabel("Full name")).toBeVisible();
  const toPay = summary.getByRole("button", { name: "Continue to payment" });
  await toPay.click();
  await expect(page.getByText("Write the name of the person who will receive the boxes.")).toBeVisible();
  await page.getByLabel("Full name").fill("Mona Adel");
  await page.getByLabel("Mobile number").fill("010 1234 5678");
  await page.getByLabel("Governorate").selectOption("Giza");
  await page.getByLabel("City or district").fill("Dokki");
  await page.getByLabel("Street address").fill("12 Tahrir St");

  // Proof review on the same step: approval is required
  await expect(page.getByRole("tab", { name: "3D proof" })).toBeVisible();
  await page.getByRole("tab", { name: "Flat proof" }).click();
  await expect(page.getByRole("figure", { name: /Flat dieline proof/ })).toBeVisible();
  await toPay.click();
  await expect(page.getByText("Tick the box to confirm you checked the design.")).toBeVisible();
  await page.getByLabel("I checked the design. Print it as it is.").check();
  await toPay.click();

  // 3) Payment: a declined card, then a good one
  await expect(page).toHaveURL(/\/en\/checkout\/pay\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Payment" })).toBeVisible();
  await expect(page.getByTestId("pay-total")).toContainText("EGP");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
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
  const progress = page.getByRole("group", { name: "Progress" });
  // Paid, the printer has not confirmed yet: "Order received" stays current (R3-11); the detailed
  // steps (printer acceptance first, R4-CR-04) sit behind "All steps in detail".
  await expect(progress.locator('[aria-current="step"]')).toContainText("Order received");
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
  // Without the seller tax registration number it is a receipt, not a tax invoice (R4-B-07).
  await expect(page.getByRole("heading", { level: 1 })).toContainText("(not a tax invoice)");
  await expect(page.getByText("Not submitted yet")).toHaveCount(0);
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

test("above 2,000 boxes the buyer sends a price request and sees it in the account", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page);
  const res = await page.request.post("/api/designs", { data: { doc } });
  const { id: designId } = (await res.json()) as { id: string };

  await page.goto(`/en/checkout/${designId}`);
  await expect(page.getByTestId("checkout-total")).toBeVisible();
  await page.getByRole("button", { name: "Another quantity" }).click();
  await page.getByLabel("Number of boxes").fill("5,000");
  await page.getByLabel("Number of boxes").press("Enter");
  await expect(page.getByRole("heading", { name: "Request a price for 5,000 boxes" })).toBeVisible();
  // No dead end: no disabled "Continue" for a quantity that cannot be ordered instantly.
  await expect(page.getByRole("button", { name: "Continue to address" })).toHaveCount(0);
  await page.getByLabel(/Anything we should know/).fill("Delivery in two batches");
  await page.getByRole("button", { name: "Request a price" }).click();
  await expect(page.getByText("Price request sent for 5,000 boxes")).toBeVisible();

  await page.getByRole("link", { name: "View my requests" }).click();
  await expect(page).toHaveURL(/\/en\/account#quote-requests$/);
  const list = page.locator("#quote-requests");
  await expect(list).toContainText("5,000 boxes · E2E mailer");
  await expect(list).toContainText("Waiting for price");
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

test("a share link shows the checkout price to a signed-out visitor", async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  await signIn(page);
  const res = await page.request.post("/api/designs", { data: { doc } });
  const { id: designId } = (await res.json()) as { id: string };
  const share = await page.request.post(`/api/designs/${designId}/share`);
  const { path } = (await share.json()) as { path: string };

  // Same figure as the 500-box tier on checkout step 1.
  await page.goto(`/en/checkout/${designId}`);
  const tier = page.getByRole("radio", { name: /^500 boxes/ });
  const tierText = (await page.locator("label").filter({ has: tier }).first().textContent()) ?? "";
  // Tiles show the total first, then "EGP x per box".
  const unit = /(EGP [\d,.]+) per box/.exec(tierText)?.[1];
  expect(unit).toBeTruthy();

  const visitor = await browser.newContext({ baseURL });
  const anon = await visitor.newPage();
  await anon.goto(`/en${path}`);
  await expect(anon.getByTestId("share-price")).toContainText(`500 boxes from ${unit} each after the 3% prepay discount, excl. VAT`);
  await visitor.close();
});
