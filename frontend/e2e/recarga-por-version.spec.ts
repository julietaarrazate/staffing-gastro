import { test, expect } from "@playwright/test";
import { blockExternalHosts, setTheme, skipSplash } from "./mocks";

/**
 * Recarga por versión nueva (components/ActualizadorVersion.tsx): si
 * `/version.json` dice otra versión que la del bundle, la página se recarga
 * sola, una única vez por versión.
 */
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

test("se recarga una sola vez cuando hay versión nueva", async ({ page }) => {
  await setTheme(page, "light");
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => r.fulfill(json({ detail: "no" }, 404)));
  await page.route("**/api/v1/auth/guest", (r) => r.fulfill(json({ enabled: false })));
  let pedidos = 0;
  await page.route("**/version.json*", (r) => {
    pedidos += 1;
    return r.fulfill(json({ version: "version-nueva-e2e" }));
  });
  let cargas = 0;
  // "load" sólo salta con cargas completas del documento, no con las
  // navegaciones internas del router.
  page.on("load", () => {
    cargas += 1;
  });
  await page.goto("/login");
  // 1ª carga + 1 recarga; la 2ª vez ve la marca en sessionStorage y no insiste.
  await expect.poll(() => cargas, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  await expect.poll(() => pedidos).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(1500);
  expect(cargas).toBe(2);
});

test("no se recarga si la versión servida es la del bundle", async ({ page }) => {
  await setTheme(page, "light");
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => r.fulfill(json({ detail: "no" }, 404)));
  await page.route("**/api/v1/auth/guest", (r) => r.fulfill(json({ enabled: false })));
  const real = await (await page.request.get("/version.json")).json();
  expect(real.version).toBeTruthy();
  await page.route("**/version.json*", (r) => r.fulfill(json(real)));
  let cargas = 0;
  // "load" sólo salta con cargas completas del documento, no con las
  // navegaciones internas del router.
  page.on("load", () => {
    cargas += 1;
  });
  await page.goto("/login");
  await page.waitForTimeout(2000);
  expect(cargas).toBe(1);
});

test("con la app en uso no corta la pantalla: recarga al cambiar de pantalla", async ({ page }) => {
  await setTheme(page, "light");
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (r) => r.fulfill(json({ detail: "no" }, 404)));
  await page.route("**/api/v1/auth/guest", (r) => r.fulfill(json({ enabled: false })));
  const real = await (await page.request.get("/version.json")).json();
  let servida = real;
  let pedidos = 0;
  await page.route("**/version.json*", (r) => {
    pedidos += 1;
    return r.fulfill(json(servida));
  });
  let cargas = 0;
  page.on("load", () => {
    cargas += 1;
  });
  await page.goto("/login");
  await expect.poll(() => pedidos).toBeGreaterThanOrEqual(1);
  // Se publica una versión nueva y la app vuelve a primer plano enseguida
  // (p. ej. tras elegir una foto): avisa, pero no recarga.
  servida = { version: "version-nueva-e2e" };
  const antes = pedidos;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => pedidos).toBeGreaterThan(antes);
  await page.waitForTimeout(1000);
  expect(cargas).toBe(1);
  // Al pasar a otra pantalla, recarga una vez, ya en la pantalla nueva.
  await page.getByRole("link", { name: /recuper|olvid/i }).first().click();
  await expect.poll(() => cargas, { timeout: 15_000 }).toBe(2);
  await expect(page).toHaveURL(/\/recuperar/);
  await page.waitForTimeout(1000);
  expect(cargas).toBe(2);
});
