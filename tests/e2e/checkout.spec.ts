import { expect, test } from "@playwright/test";

test("checkout requires a delivery date and contact details", async ({ page }) => {
  await page.route("**/api/cart", async (route) => {
    await route.fulfill({ json: {
      cartId: "cart", subtotal: 10000, deliveryFee: 2000, deliveryOptions: { date: 2000 }, total: 12000, currency: "INR",
      lines: [{ id: "line", productId: "product", productName: "Flowers", productSlug: "flowers", qty: 1, unitPrice: 10000, total: 10000, palette: ["#fff", "#ddd"], addVase: false }],
    } });
  });
  await page.route("**/api/account/addresses", async (route) => {
    await route.fulfill({ json: { addresses: [{
      id: "address", label: "Home", line1: "1 Flower Street", city: "Chennai", zip: "600001", phone: "9876543210", isDefault: true,
    }] } });
  });

  await page.goto("/checkout");
  await page.getByRole("button", { name: /continue to details/i }).click();
  await expect(page.getByText("Choose a delivery date between tomorrow and 30 days from now.")).toBeVisible();
  const date = page.getByLabel("Pick a date");
  const minimum = await date.getAttribute("min");
  expect(minimum).toBeTruthy();
  await date.fill(minimum!);
  await page.getByRole("button", { name: /continue to details/i }).click();
  await expect(page.getByLabel("Delivery address")).toHaveValue("1 Flower Street");
  await expect(page.getByLabel("Postal code")).toHaveValue("600001");
  await page.getByRole("button", { name: /review order/i }).click();
  await expect(page.getByText("Required").first()).toBeVisible();
  await page.getByLabel("Your email").fill("customer@example.com");
  await page.getByLabel("Your name").fill("Customer");
  await page.getByLabel("Phone").fill("9876543210");
  await page.getByLabel("Delivery address").fill("1 Flower Street");
  await page.getByLabel("City").fill("Chennai");
  await page.getByLabel("Postal code").fill("600001");
  await page.getByRole("button", { name: /review order/i }).click();
  await expect(page.getByRole("heading", { name: "Final look" })).toBeVisible();
  await expect(page.getByText(minimum!)).toBeVisible();
  await expect(page.getByText(/1 Flower Street, Chennai, 600001/)).toBeVisible();
});