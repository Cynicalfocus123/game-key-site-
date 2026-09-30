import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, noHorizontalScroll, registerAndVerify, signInDemoAdmin, signOutFromAccount, uniqueEmail } from "./helpers";
import { renderEmail, sampleEmail } from "../lib/emails";

// Email task (2026-09-29): shared email layout, 6-digit verify code, Orders list (Eneba style), order page, seller rating,
// receipt page with optional tax details, sign-in / password emails, admin email previews. Demo store = same rules as the server.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("corecart-currency", "THB")); });

type Mail = { to: string; subject: string; html: string; template: string };
const outbox = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("corecart-demo-v1") || "{}").outbox ?? []) as Mail[]);
const mailsTo = async (page: Page, to: string) => (await outbox(page)).filter((m) => m.to === to);

test("verify email with the 6-digit code (wrong code first), welcome email", async ({ page }) => {
  const email = uniqueEmail("code");
  await page.goto("register/");
  await page.locator("input[name=name]").fill("Code Tester");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(DEMO_PASSWORD);
  await page.locator("input[name=confirm]").fill(DEMO_PASSWORD);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const code = (await page.locator(".demo-code b").textContent())!.trim();
  expect(code).toMatch(/^\d{6}$/);
  const verify = (await mailsTo(page, email)).find((m) => m.template === "verify")!;
  expect(verify.subject).toBe(`${code} is your CoreCart confirmation code`);
  expect(verify.html).toContain(code);
  expect(verify.html).toContain("valid for <b>10 minutes</b>");
  await noHorizontalScroll(page);
  const wrong = code === "000000" ? "111111" : "000000";
  await page.getByLabel("Confirmation code").fill(wrong);
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(page.getByText("Wrong code. Check the email and try again.")).toBeVisible();
  await page.getByLabel("Confirmation code").fill(code);
  await page.getByRole("button", { name: "Confirm email" }).click();
  await page.waitForURL(/account\/?\?verified=1/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  expect((await mailsTo(page, email)).map((m) => m.template)).toContain("welcome");
});

test("orders list: Eneba columns, search, whole row opens the order page; phone cards / tablet layout", async ({ page, isMobile }) => {
  await registerAndVerify(page);
  await page.goto("account/orders/");
  await page.getByRole("button", { name: "Add sample order (test only)" }).click();
  const rows = page.locator(".orders-table > tbody > tr");
  await expect(rows).toHaveCount(3);
  if (!isMobile) await expect(page.locator(".orders-table thead th")).toHaveText(["Date", "Status", "Order title", "Order ID", "Payment method", "Total amount", "Details"]);
  const first = rows.first();
  await expect(first.locator(".ord-status")).toHaveText("Order fulfilled");
  await expect(first).toContainText("Xbox Game Pass Ultimate 1 Month");
  await expect(rows.nth(2).locator(".ord-status")).toHaveText("Processing"); // paid, hardware not shipped yet
  const number = (await rows.nth(1).locator(".c-id code").textContent())!.trim();
  // Search: part of the number, lower case, without the dash.
  await page.getByPlaceholder("Search by order ID").fill(number.slice(3, 8).toLowerCase());
  await expect(rows).toHaveCount(1);
  await page.getByPlaceholder("Search by order ID").fill("zzzz");
  await expect(page.getByText("No order matches “zzzz”.")).toBeVisible();
  await page.getByPlaceholder("Search by order ID").fill("");
  await expect(rows).toHaveCount(3);
  await noHorizontalScroll(page);
  if (isMobile) {
    // Phone: one card per order (grid), header row hidden.
    await expect(page.locator(".orders-table thead")).not.toBeInViewport();
    expect(await rows.first().evaluate((el) => getComputedStyle(el).display)).toBe("grid");
  } else {
    // Tablet portrait (768 / 900): cards like phones. Small laptop / tablet landscape (1100): table without Payment method. No sideways scroll anywhere.
    for (const width of [768, 900]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await rows.first().evaluate((el) => getComputedStyle(el).display), `${width}px`).toBe("grid");
      await noHorizontalScroll(page);
    }
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(page.locator(".orders-table th.col-pay")).toBeHidden();
    await expect(page.locator(".orders-table thead")).toBeVisible();
    await noHorizontalScroll(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator(".orders-table th.col-pay")).toBeVisible();
    await noHorizontalScroll(page);
  }
  // Click anywhere on the row (not only Details) → order page.
  await rows.nth(1).locator(".c-title").click();
  await expect(page).toHaveURL(/account\/orders\/view\/?\?id=/);
  await expect(page.getByRole("heading", { name: `Order ${number}` })).toBeVisible();
});

test("order page: products, payment details, summary, receipts; rate the seller (1–5 + comment, edit)", async ({ page }) => {
  await registerAndVerify(page);
  await page.goto("account/orders/");
  await page.locator(".orders-table > tbody > tr").first().getByRole("link", { name: /Details/ }).click();
  const pageBox = page.locator(".ord-page");
  await expect(pageBox.getByRole("heading", { name: "Ordered products" })).toBeVisible();
  await expect(pageBox.locator(".order-items li")).toHaveCount(2);
  await expect(pageBox.locator(".order-items li").first()).toContainText("Seller: CoreCart");
  await expect(pageBox.getByRole("link", { name: /Reveal key/ })).toHaveCount(2);
  await expect(pageBox.locator(".ord-big")).toContainText("Payment complete");
  await expect(pageBox.locator(".ord-facts")).toContainText("Credit or debit card •••• 4242");
  await expect(pageBox.locator(".ord-total")).toContainText("Total amount:");
  await expect(pageBox.getByRole("link", { name: "Download receipt" })).toHaveAttribute("href", /account\/orders\/receipt\/?\?id=/);
  await expect(pageBox.getByRole("link", { name: "Add tax ID tax invoice" })).toHaveAttribute("href", /doc=invoice/);
  await noHorizontalScroll(page);

  await pageBox.getByRole("button", { name: /Rate the seller/ }).click();
  const dlg = page.getByRole("dialog", { name: "Rate CoreCart" });
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "Send rating" }).click();
  await expect(dlg.getByText("Choose 1 to 5 stars.")).toBeVisible();
  await dlg.getByRole("radio", { name: /4 stars/ }).check();
  await dlg.getByLabel("Comment (optional)").fill("Fast delivery, key worked.");
  await noHorizontalScroll(page);
  await dlg.getByRole("button", { name: "Send rating" }).click();
  await expect(dlg).toBeHidden();
  await expect(page.getByText("Thanks! Your rating for CoreCart is saved.")).toBeVisible();
  await expect(pageBox.getByLabel("You rated 4 of 5")).toBeVisible();
  // Saved: reload keeps it; edit opens with 4 stars + comment, Esc closes.
  await page.reload();
  await pageBox.getByRole("button", { name: /Edit rating/ }).click();
  await expect(dlg.getByLabel("Comment (optional)")).toHaveValue("Fast delivery, key worked.");
  await expect(dlg.getByRole("radio", { name: /4 stars/ })).toBeChecked();
  await dlg.getByRole("radio", { name: /5 stars/ }).check();
  await dlg.getByRole("button", { name: "Update rating" }).click();
  await expect(pageBox.getByLabel("You rated 5 of 5")).toBeVisible();
  // Email link "Rate the seller" = ?rate=1 opens the pop-up.
  await page.goto(`${page.url()}&rate=1`);
  await expect(dlg).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
});

test("receipt page: plain receipt, optional tax details → tax invoice, remove; print button", async ({ page }) => {
  await registerAndVerify(page, { name: "Receipt Tester" });
  await page.goto("account/orders/");
  await page.locator(".orders-table > tbody > tr").first().getByRole("link", { name: /Details/ }).click();
  await page.getByRole("link", { name: "Download receipt" }).click();
  await expect(page).toHaveURL(/account\/orders\/receipt\/?\?id=/);
  const doc = page.locator(".receipt-doc");
  await expect(page.getByRole("heading", { name: "Receipt", exact: true })).toBeVisible();
  await expect(doc).toContainText("RECEIPT");
  await expect(doc).toContainText("Receipt Tester");
  await expect(doc).toContainText("Elden Ring");
  await expect(doc).toContainText("Total paid");
  await expect(page.getByRole("button", { name: "Print / Save as PDF" })).toBeVisible();
  await expect(page.getByText("Tax is optional.")).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Add tax details" }).click();
  await page.getByLabel("Name or company").fill("Receipt Tester Co., Ltd.");
  await page.getByLabel("Tax ID").fill("12");
  await page.getByLabel("Billing address").fill("1 Sukhumvit Rd, Bangkok 10110");
  await page.getByRole("button", { name: "Save tax details" }).click();
  await expect(page.getByText("Tax ID: 5–20 letters, digits or dashes.")).toBeVisible();
  await page.getByLabel("Tax ID").fill("0105561234567");
  await page.getByRole("button", { name: "Save tax details" }).click();
  await expect(page.getByRole("heading", { name: "Tax invoice / Receipt" })).toBeVisible();
  await expect(doc).toContainText("Tax ID 0105561234567");
  await page.reload();
  await expect(doc).toContainText("TAX INVOICE / RECEIPT");
  await page.getByRole("button", { name: "Remove tax details" }).click();
  await expect(page.getByRole("heading", { name: "Receipt", exact: true })).toBeVisible();
  // Invoice link opens the tax form straight away.
  await page.goto(`${page.url()}&doc=invoice`);
  await expect(page.getByLabel("Tax ID")).toBeVisible();
  await noHorizontalScroll(page);
});

test("emails: sample order → order confirmed, password change, new sign-in on a new device only", async ({ page }) => {
  const email = await registerAndVerify(page, { name: "Mail Tester" });
  await page.goto("account/orders/");
  await page.getByRole("button", { name: "Add sample order (test only)" }).click();
  await expect(page.locator(".orders-table > tbody > tr")).toHaveCount(3);
  const order = (await mailsTo(page, email)).find((m) => m.template === "orderConfirmed")!;
  expect(order.subject).toMatch(/^Your CoreCart order CC-[A-Z0-9]{8} is confirmed$/);
  expect(order.html).toContain("Purchased products");
  expect(order.html).toMatch(/account\/orders\/view\?id=[^"&]+"[^>]*>Get key</);
  expect(order.html).toContain("&amp;rate=1");
  expect(order.html).toContain("/account/orders/receipt?id=");
  expect(order.html).not.toContain("DEMO-"); // keys are never in an email
  // Password change in Settings → "password was changed".
  await page.goto("account/settings/");
  await page.getByLabel("Current password").fill(DEMO_PASSWORD);
  await page.getByLabel("New password").fill(`${DEMO_PASSWORD}-2`);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect.poll(async () => (await mailsTo(page, email)).some((m) => m.template === "passwordChanged")).toBe(true);
  // Same device: no alert. New device (device id cleared): "New sign-in" email.
  await page.goto("account/");
  await signOutFromAccount(page);
  const signIn = async () => {
    await page.goto("login/");
    await page.locator("input[name=email]").fill(email);
    await page.locator("input[name=password]").fill(`${DEMO_PASSWORD}-2`);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  };
  await signIn();
  expect((await mailsTo(page, email)).filter((m) => m.template === "newSignIn")).toHaveLength(0);
  await signOutFromAccount(page);
  await page.evaluate(() => localStorage.removeItem("corecart-demo-device"));
  await signIn();
  const alert = (await mailsTo(page, email)).filter((m) => m.template === "newSignIn");
  expect(alert).toHaveLength(1);
  expect(alert[0].html).toContain("Bangkok, Thailand (sample location)");
  // Login history shows the location column.
  await page.goto("account/login-history/");
  await expect(page.locator(".dash-table tbody tr").first()).toContainText("Bangkok, Thailand (sample location)");
});

test("admin email previews: every template, phone width, plain text, send test, outbox", async ({ page, isMobile }) => {
  const email = await registerAndVerify(page);
  await page.goto("account/");
  await signOutFromAccount(page);
  await signInDemoAdmin(page);
  await page.goto("admin/emails/");
  await expect(page.getByRole("heading", { name: "Emails", exact: true })).toBeVisible();
  const frame = page.frameLocator(".mail-frame iframe");
  await expect(frame.getByRole("heading", { name: "Your email confirmation code" })).toBeVisible();
  await noHorizontalScroll(page); // default "Desktop 600" preview must not widen the page on phones
  if (isMobile) await page.getByLabel("Email template", { exact: true }).selectOption({ label: "Orders · Order confirmed (keys ready)" });
  else await page.getByRole("navigation", { name: "Email templates" }).getByRole("button", { name: "Order confirmed (keys ready)" }).click();
  await expect(frame.getByRole("heading", { name: "Your order has been confirmed" })).toBeVisible();
  await expect(frame.getByRole("link", { name: "Get key" })).toBeVisible();
  await expect(frame.getByRole("link", { name: "Rate the seller" })).toBeVisible();
  await expect(frame.getByRole("link", { name: "Get receipt" })).toBeVisible();
  await page.getByRole("button", { name: "Phone 375" }).click();
  expect(await page.locator(".mail-frame").evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(376);
  await page.getByRole("button", { name: "Plain text" }).click();
  await expect(page.locator(".mail-text")).toContainText("Get your keys:");
  await page.getByRole("button", { name: "Email", exact: true }).click();
  await page.getByRole("button", { name: "Send test to me" }).click();
  await expect(page.getByText(/Test email sent to admin@corecart\.demo/)).toBeVisible();
  const box = page.locator(".mail-outbox tbody tr");
  await expect(box.first()).toContainText("[Test] Your CoreCart order CC-4K7Q2M9X is confirmed");
  await expect(box.filter({ hasText: email }).first()).toBeVisible(); // the customer's verify / welcome emails
  await box.filter({ hasText: "is your CoreCart confirmation code" }).first().getByRole("button", { name: /Open/ }).click();
  await expect(frame.getByRole("heading", { name: "Your email confirmation code" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("email layout: same header, footer and escaping in every template", async ({ isMobile }) => {
  test.skip(isMobile, "Pure template check (HTML strings, no screen); runs once on desktop. The phone look is covered by the admin preview test on mobile.");
  const site = "https://shop.example";
  for (const id of ["verify", "welcome", "reset", "passwordChanged", "newSignIn", "emailChanged", "adminCreated", "orderConfirmed", "paymentFailed", "refund", "returnUpdate", "topUp", "giftCard", "balanceAdjusted", "ticketCreated", "ticketReply", "sellerReceived", "sellerApproved", "sellerRejected"] as const) {
    const m = renderEmail(id, sampleEmail(id, site) as never, site);
    expect(m.html, id).toContain("linear-gradient(90deg,#2563EB 0%,#4F46E5 50%,#7C3AED 100%)");
    expect(m.html, id).toContain(`${site}/account/tickets?new=1`);
    expect(m.html, id).toContain("All rights reserved.");
    expect(m.text, id).toContain("Support: https://shop.example/account/tickets?new=1");
    expect(m.subject.length, id).toBeGreaterThan(5);
  }
  // Rejection email: hero (PNG illustration + big title), personal / business, reason escaped, support email + ticket button.
  const personal = renderEmail("sellerRejected", { name: "Alex", merchant: "Gaming4Life", reason: "Bad <b>invoice</b>", business: false }, site);
  expect(personal.subject).toBe("Your CoreCart personal verification was declined");
  expect(personal.html).toContain(`<img src="${site}/email/verification-rejected.png" width="240" height="160" alt="Verification rejected"`);
  expect(personal.html).toContain("text-transform:uppercase");
  expect(personal.html).toContain(">Personal verification rejected</h1>");
  expect(personal.html).toContain("your <b>personal verification</b> for the seller profile <b>Gaming4Life</b> has been <b>declined</b>");
  expect(personal.html).toContain("Bad &lt;b&gt;invoice&lt;/b&gt;");
  expect(personal.html).toContain("support@corecart.example");
  expect(personal.html).toContain(`href="${site}/account/tickets?new=1"`);
  expect(personal.text).toContain("PERSONAL VERIFICATION REJECTED");
  expect(personal.text).toContain("Reason: Bad <b>invoice</b>");
  const business = renderEmail("sellerRejected", { name: "", merchant: "Shop & Co", reason: "x", business: true }, site);
  expect(business.subject).toBe("Your CoreCart business verification was declined");
  expect(business.html).toContain(">Business verification rejected</h1>");
  expect(business.html).toContain("Hello,");
  expect(business.html).toContain("<b>Shop &amp; Co</b>");
  expect(renderEmail("welcome", { name: "A" }, site).html).not.toContain("<img"); // no hero on the other emails
  const bad = renderEmail("ticketReply", { name: "<script>x</script>", number: 1, subject: "S", excerpt: "<img src=x onerror=alert(1)>", ticketId: "t" }, site);
  expect(bad.html).not.toContain("<script>x");
  expect(bad.html).not.toContain("<img src=x");
  expect(bad.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
});

test("rejection email preview: illustration loads, big title, reason, CONTACT SUPPORT TEAM button; fits the phone", async ({ page, isMobile }) => {
  await signInDemoAdmin(page);
  await page.goto("admin/emails/");
  if (isMobile) await page.getByLabel("Email template", { exact: true }).selectOption({ label: "Seller · Seller rejected (verification)" });
  else await page.getByRole("navigation", { name: "Email templates" }).getByRole("button", { name: "Seller rejected (verification)" }).click();
  await expect(page.locator(".mail-meta")).toContainText("Your CoreCart personal verification was declined");
  const frame = page.frameLocator(".mail-frame iframe");
  await expect(frame.getByRole("heading", { name: "Personal verification rejected" })).toBeVisible();
  const art = frame.getByRole("img", { name: "Verification rejected" });
  await expect(art).toBeVisible();
  await expect.poll(() => art.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBe(480); // PNG served by the site (wait: slow load under parallel runs)
  await expect(frame.getByText("The sample invoices do not show the key supplier.")).toBeVisible();
  await expect(frame.getByRole("link", { name: "CONTACT SUPPORT TEAM" })).toHaveAttribute("href", /\/account\/tickets\?new=1$/);
  await page.getByRole("button", { name: "Phone 375" }).click();
  const box = await frame.getByRole("img", { name: "Verification rejected" }).boundingBox();
  expect(box!.width).toBeLessThanOrEqual(240);
  await noHorizontalScroll(page);
});
