import { test, expect, type Page, type Route } from "@playwright/test";
import {
  blockExternalHosts,
  injectSession,
  mockEmptyNotifications,
  skipSplash,
  TOKEN_KEY,
} from "./mocks";

/**
 * Verificación en dos pasos obligatoria para la cuenta admin (ADR-0023), con
 * la API mockeada: el código en el login (con contraseña, con un código de
 * recuperación, y el desafío que vence), el alta cuando el panel responde
 * 403 y los ajustes con la verificación activa.
 */

const ADMIN = {
  id: "admin-1",
  email: "hola@oido.com.ar",
  full_name: "Julieta Arrazate",
  role: "admin",
  status: "active",
  is_verified: true,
};

const RECOVERY = [
  "a2b3-c4d5-e6f7",
  "g8h9-jkmn-pqrs",
  "tuvw-xyz2-3456",
  "789a-bcde-fghj",
  "kmnp-qrst-uvwx",
  "yz23-4567-89ab",
  "cdef-ghjk-mnpq",
  "rstu-vwxy-z234",
  "5678-9abc-defg",
  "hjkm-npqr-stuv",
];

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

/** Lo que no importa en estos specs (el panel de "Hoy", contadores): vacío. */
async function mockRestOfApi(page: Page) {
  await page.route("**/api/v1/**", (route) => route.fulfill(json([])));
  await mockEmptyNotifications(page);
}

async function fillLogin(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(ADMIN.email);
  await page.getByPlaceholder("Contraseña").fill("una-contraseña-larga");
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test.describe("login de la admin con la verificación activa", () => {
  test.beforeEach(async ({ page }) => {
    await skipSplash(page);
    await blockExternalHosts(page);
    await mockRestOfApi(page);
    await page.route("**/api/v1/auth/login", (route) =>
      route.fulfill(
        json({ two_factor_required: true, challenge_token: "desafio-1", expires_in: 300 })
      )
    );
  });

  test("pide el código y recién con uno válido entra", async ({ page }) => {
    const sent: string[] = [];
    await page.route("**/api/v1/auth/2fa/verify", (route: Route) => {
      const body = route.request().postDataJSON() as { challenge_token: string; code: string };
      sent.push(`${body.challenge_token}:${body.code}`);
      if (body.code !== "246810") {
        return route.fulfill(json({ detail: "El código no es válido." }, 401));
      }
      return route.fulfill(
        json({
          access_token: "token-verificado",
          token_type: "bearer",
          user: ADMIN,
          used_recovery_code: false,
          recovery_codes_left: 10,
        })
      );
    });
    await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(ADMIN)));

    await fillLogin(page);
    await expect(page.getByRole("heading", { name: "Verificación en dos pasos" })).toBeVisible();
    // Sin sesión todavía.
    expect(await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).toBeNull();

    const field = page.getByLabel("Código de la app");
    await field.fill("13579a");
    await expect(field).toHaveValue("13579");
    await field.fill("135790");
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(page.getByText("El código no es válido.")).toBeVisible();

    await page.getByLabel("Código de la app").fill("246810");
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(page).not.toHaveURL(/\/login/);
    expect(await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).toBe(
      "token-verificado"
    );
    expect(sent).toEqual(["desafio-1:135790", "desafio-1:246810"]);
  });

  test("sin el celular entra con un código de recuperación y le avisa cuántos quedan", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/2fa/verify", (route) =>
      route.fulfill(
        json({
          access_token: "token-verificado",
          token_type: "bearer",
          user: ADMIN,
          used_recovery_code: true,
          recovery_codes_left: 9,
        })
      )
    );
    await fillLogin(page);
    await page.getByRole("button", { name: /usar un código de recuperación/ }).click();
    await page.getByLabel("Código de recuperación").fill(RECOVERY[0]);
    await page.getByRole("button", { name: "Verificar" }).click();

    await expect(page.getByText("Entraste con un código de recuperación.")).toBeVisible();
    await expect(page.getByText("9", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ir a Seguridad" }).click();
    await expect(page).toHaveURL(/\/admin\/seguridad$/);
  });

  test("si el ingreso venció, vuelve a pedir la contraseña", async ({ page }) => {
    await page.route("**/api/v1/auth/2fa/verify", (route) =>
      route.fulfill(
        json(
          {
            detail: {
              code: "two_factor_challenge_invalid",
              message: "El ingreso venció. Volvé a poner tu contraseña.",
            },
          },
          401
        )
      )
    );
    await fillLogin(page);
    await page.getByLabel("Código de la app").fill("246810");
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(page.getByText("El ingreso venció. Volvé a poner tu contraseña.")).toBeVisible();
    await expect(page.getByPlaceholder("Contraseña")).toHaveValue("");
  });
});

test("una admin sin la verificación va al alta, la activa y guarda los códigos", async ({
  page,
}) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  // Hasta activarla, todo lo de admin responde 403 con el código del candado.
  let enabled = false;
  await page.route("**/api/v1/**", (route) =>
    route.fulfill(
      enabled
        ? json([])
        : json(
            {
              detail: {
                code: "two_factor_setup_required",
                message: "Activá la verificación en dos pasos para usar el panel de admin.",
              },
            },
            403
          )
    )
  );
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(ADMIN)));
  await page.route("**/api/v1/auth/2fa", (route) =>
    route.fulfill(
      json({
        enabled,
        enabled_at: enabled ? "2026-10-23T18:00:00Z" : null,
        recovery_codes_left: enabled ? 10 : 0,
      })
    )
  );
  await page.route("**/api/v1/auth/2fa/setup", (route) =>
    route.fulfill(
      json({
        secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
        otpauth_uri:
          "otpauth://totp/O%C3%ADdo:hola@oido.com.ar?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=O%C3%ADdo",
      })
    )
  );
  await page.route("**/api/v1/auth/2fa/confirm", (route) => {
    const { code } = route.request().postDataJSON() as { code: string };
    if (code !== "112233") {
      return route.fulfill(json({ detail: "El código no es válido." }, 400));
    }
    enabled = true;
    return route.fulfill(
      json({
        access_token: "token-verificado",
        token_type: "bearer",
        user: ADMIN,
        recovery_codes: RECOVERY,
      })
    );
  });

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/seguridad$/);
  // Mientras falta el alta, sin menú del panel.
  await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toHaveCount(0);

  await page.getByRole("button", { name: "Activar la verificación" }).click();
  await expect(page.getByRole("img", { name: /Código QR/ })).toBeVisible();
  await expect(page.getByText("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP")).toBeVisible();

  await page.getByLabel("Código de la app").fill("000000");
  await page.getByRole("button", { name: "Activar", exact: true }).click();
  await expect(page.getByText("El código no es válido.")).toBeVisible();

  await page.getByLabel("Código de la app").fill("112233");
  await page.getByRole("button", { name: "Activar", exact: true }).click();
  await expect(page.getByText("Listo: la verificación está activa")).toBeVisible();
  for (const code of RECOVERY) await expect(page.getByText(code)).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).toBe("token-verificado");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar" }).click();
  expect((await download).suggestedFilename()).toBe("oido-codigos-de-recuperacion.txt");

  const done = page.getByRole("button", { name: "Ir al panel" });
  await expect(done).toBeDisabled();
  await page.getByLabel("Los guardé en un lugar seguro.").check();
  // Ya verificada: aparece el menú y el resto del panel.
  await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeVisible();
  await done.click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("con la verificación activa: estado y códigos nuevos con un código actual", async ({
  page,
}) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockRestOfApi(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(ADMIN)));
  await page.route("**/api/v1/auth/2fa", (route) =>
    route.fulfill(
      json({ enabled: true, enabled_at: "2026-10-23T18:00:00Z", recovery_codes_left: 2 })
    )
  );
  let sentCode = "";
  await page.route("**/api/v1/auth/2fa/recovery-codes", (route) => {
    sentCode = (route.request().postDataJSON() as { code: string }).code;
    return route.fulfill(json({ recovery_codes: RECOVERY }));
  });

  await page.goto("/admin/seguridad");
  await expect(page.getByText("Activa", { exact: true })).toBeVisible();
  await expect(page.getByText("Desde el 23/10/2026.")).toBeVisible();
  await expect(page.getByText(/Te quedan 2 códigos de recuperación/)).toBeVisible();

  await page.getByRole("button", { name: "Generar códigos nuevos" }).click();
  await page.getByLabel("Código actual").fill("654321");
  await page.getByRole("button", { name: "Generar códigos nuevos" }).last().click();
  await expect(page.getByText("Códigos de recuperación nuevos")).toBeVisible();
  expect(sentCode).toBe("654321");
  await page.getByLabel("Los guardé en un lugar seguro.").check();
  await page.getByRole("button", { name: "Listo" }).click();
  await expect(page.getByText(/Te quedan 10 códigos de recuperación/)).toBeVisible();
});

test("en Ajustes, la admin llega a la verificación en dos pasos", async ({ page }) => {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await mockRestOfApi(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(ADMIN)));
  await page.goto("/profile/settings");
  await expect(page.getByRole("link", { name: "Verificación en dos pasos" })).toHaveAttribute(
    "href",
    "/admin/seguridad"
  );
});
