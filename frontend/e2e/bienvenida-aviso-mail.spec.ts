import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications, setTheme, skipSplash } from "./mocks";

/**
 * Tras el alta con email, la bienvenida NO afirma que el mail salió (el alta no
 * lo sabe): dice a qué dirección, qué revisar y deja pedirlo de nuevo con el
 * reenvío que ya existe.
 */
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

for (const tema of ["light", "dark"] as const) {
  test(`aviso del mail de confirmación sin afirmar el envío, con salida (${tema})`, async ({ page }) => {
    await setTheme(page, tema);
    await skipSplash(page);
    await injectSession(page);
    await blockExternalHosts(page);
    await page.addInitScript(() => window.sessionStorage.setItem("staffya_aviso_mail", "1"));
    await page.route("**/api/v1/**", (r) => (r.request().method() === "GET" ? r.fulfill(json([])) : r.continue()));
    await mockEmptyNotifications(page);
    await page.route("**/api/v1/auth/me", (r) =>
      r.fulfill(json({ id: "u", email: "ana@correo.com", full_name: "Ana", role: "employer", status: "activo", is_active: true, is_verified: true })),
    );
    await page.route("**/api/v1/companies/me/profile", (r) => r.fulfill(json({ detail: "no" }, 404)));
    let pedido: unknown = null;
    await page.route("**/api/v1/auth/resend-verification", (r) => {
      pedido = r.request().postDataJSON();
      return r.fulfill(json({ ok: true }));
    });

    await page.goto("/bienvenida");
    const aviso = page.getByTestId("aviso-mail");
    await expect(aviso).toContainText("ana@correo.com");
    await expect(aviso).toContainText("que la dirección esté bien escrita");
    await expect(aviso).not.toContainText("Te mandamos");
    await page.screenshot({ path: `/tmp/claude-0/aviso-${tema}.png` });

    await aviso.getByRole("button", { name: "Pedir el mail de nuevo" }).click();
    await expect(page.getByTestId("aviso-mail-pedido")).toBeVisible();
    expect(pedido).toEqual({ email: "ana@correo.com" });
  });
}
