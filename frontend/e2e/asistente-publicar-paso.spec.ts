import { test, expect, type Page } from "@playwright/test";
import {
  blockExternalHosts,
  enDias,
  injectSession,
  isoEnDias,
  mockEmptyNotifications,
  skipSplash,
} from "./mocks";

/**
 * G15 (U057, U135, BK-7DCC7E4AB945): el paso del asistente de publicar va en la
 * dirección (`?paso=`), el borrador y las keys de idempotencia sobreviven a una
 * recarga, y la IA completa SÓLO lo que la persona no tocó y no la arrastra de
 * paso si ya avanzó. Lo mismo para los pasos de `/bienvenida`.
 */
const EMPLOYER = {
  id: "user-1",
  email: "comercio@oido.test",
  full_name: "Bar La Esquina",
  role: "employer",
  status: "activo",
  is_active: true,
  is_verified: true,
};

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function preparar(page: Page, user: Record<string, unknown> = EMPLOYER) {
  await injectSession(page);
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill(json(route.request().method() === "GET" ? [] : {}))
  );
  await mockEmptyNotifications(page);
  await page.route("**/api/v1/auth/me", (route) => route.fulfill(json(user)));
}

const botonPublicar = (page: Page) => page.getByRole("button", { name: "Publicar turno" });

test("el paso va en la dirección: Atrás del navegador vuelve al paso anterior", async ({ page }) => {
  await preparar(page);
  await page.goto("/shifts/new");
  // Elegir el puesto ya pasa a «Cuándo».
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await expect(page).toHaveURL(/paso=1/);
  await expect(page.getByRole("heading", { name: "¿Cuándo?" })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("heading", { name: "¿Qué necesitás?" })).toBeVisible();
  await expect(page).toHaveURL(/\/shifts\/new$/);

  await page.goForward();
  await expect(page.getByRole("heading", { name: "¿Cuándo?" })).toBeVisible();
});

test("recargar conserva el paso y lo cargado; una dirección vieja no saltea pasos", async ({ page }) => {
  await preparar(page);
  await page.goto("/shifts/new");
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await page.locator('input[type="datetime-local"]').first().fill(enDias(30, "20:00"));
  await page.locator('input[type="datetime-local"]').nth(1).fill(enDias(30, "23:00"));
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByPlaceholder("48000").fill("15000");

  await page.reload();
  await expect(page.getByRole("heading", { name: "¿Cuánto pagás?" })).toBeVisible();
  await expect(page.getByPlaceholder("48000")).toHaveValue("15000");

  // El botón «Atrás» de la pantalla vuelve por el historial.
  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(page.getByRole("heading", { name: "¿Cuándo?" })).toBeVisible();

  // Sin borrador, ?paso=3 abierto en frío no se salta nada.
  await page.evaluate(() => sessionStorage.clear());
  await page.goto("/shifts/new?paso=3");
  await expect(page.getByRole("heading", { name: "¿Qué necesitás?" })).toBeVisible();
});

test("se pierde la respuesta de crear y se recarga: el reintento usa la misma clave y el mismo pedido", async ({
  page,
}) => {
  await preparar(page);
  const creates: { clave: string | null; cuerpo: string }[] = [];
  await page.route("**/api/v1/shifts", (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    creates.push({
      clave: route.request().headers()["idempotency-key"] ?? null,
      cuerpo: route.request().postData() ?? "",
    });
    if (creates.length === 1) return route.abort("failed");
    return route.fulfill(json({ id: "turno-1", status: "borrador" }, 201));
  });
  await page.route("**/api/v1/shifts/turno-1/publish", (route) =>
    route.fulfill(json({ id: "turno-1", status: "publicado" }))
  );
  await page.route(/\/api\/v1\/shifts\/turno-1$/, (route) =>
    route.fulfill(json({ id: "turno-1", status: "borrador" }))
  );

  await page.goto("/shifts/new");
  await page.getByRole("button", { name: "Mozo/a" }).click();
  await page.locator('input[type="datetime-local"]').first().fill(enDias(30, "20:00"));
  await page.locator('input[type="datetime-local"]').nth(1).fill(enDias(30, "23:00"));
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByPlaceholder("48000").fill("15000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.locator("select").nth(1).selectOption("Palermo");
  await botonPublicar(page).click();
  await expect(page.getByText("No se pudo publicar").first()).toBeVisible();

  await page.reload();
  await expect(botonPublicar(page)).toBeEnabled();
  await botonPublicar(page).click();
  await expect(page.getByText("¡Turno publicado!")).toBeVisible();

  expect(creates).toHaveLength(2);
  expect(creates[0].clave).toBeTruthy();
  expect(creates[1].clave).toBe(creates[0].clave);
  expect(creates[1].cuerpo).toBe(creates[0].cuerpo);
  // Publicado: no queda borrador ni keys en la pestaña.
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("staffya:borrador:")))).toEqual([]);
});

test.describe("«Describí el turno» con una IA lenta", () => {
  async function conIALenta(page: Page) {
    await preparar(page);
    let soltar: () => void = () => {};
    const compuerta = new Promise<void>((r) => (soltar = r));
    await page.route("**/api/v1/shifts/parse-text", async (route) => {
      await compuerta;
      await route.fulfill(
        json({
          position: "mozo",
          start_at: isoEnDias(30, "20:00"),
          end_at: isoEnDias(31, "02:00"),
          pay_amount: "45000",
          urgent: false,
          meal: false,
          tips: true,
          dress_code: null,
        })
      );
    });
    await page.goto("/shifts/new");
    await page.getByPlaceholder(/necesito un mozo/).fill("mozo el sábado, 45000");
    const pedido = page.waitForRequest("**/api/v1/shifts/parse-text");
    await page.getByRole("button", { name: "Completar" }).click();
    await pedido;
    return soltar;
  }

  test("no pisa el puesto ni la saca del paso donde ya avanzó", async ({ page }) => {
    const soltar = await conIALenta(page);
    // Elegir el puesto avanza a «Cuándo» mientras la IA todavía piensa.
    await page.getByRole("button", { name: "Cocinero/a" }).click();
    await expect(page.getByRole("heading", { name: "¿Cuándo?" })).toBeVisible();
    soltar();
    await expect(page.getByText(/Completamos lo que no habías cargado/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "¿Cuándo?" })).toBeVisible();
    await expect(page.locator('input[type="datetime-local"]').first()).toHaveValue(enDias(30, "20:00"));
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByPlaceholder("48000")).toHaveValue("45000");
    await page.getByRole("button", { name: "Continuar" }).click();
    // El resumen sigue con el puesto de la persona, no el de la IA.
    await expect(page.getByText("Cocinero/a").first()).toBeVisible();
    await expect(page.getByText("Mozo/a")).toHaveCount(0);
  });

  test("no pisa el horario que la persona ya escribió", async ({ page }) => {
    const soltar = await conIALenta(page);
    await page.getByRole("button", { name: "Cocinero/a" }).click();
    await page.locator('input[type="datetime-local"]').first().fill(enDias(40, "18:00"));
    soltar();
    await expect(page.getByText(/Completamos lo que no habías cargado/)).toBeVisible();
    await expect(page.locator('input[type="datetime-local"]').first()).toHaveValue(enDias(40, "18:00"));
    await expect(page.locator('input[type="datetime-local"]').nth(1)).not.toHaveValue("");
  });
});

test("bienvenida: una dirección con ?paso= no saltea el primer paso", async ({ page }) => {
  await preparar(page, {
    id: "user-9",
    email: "mozo@oido.test",
    full_name: "Mozo Demo",
    role: "worker",
    status: "activo",
    is_active: true,
    is_verified: true,
  });
  await page.goto("/bienvenida?paso=oficio");
  // Sin zona cargada no se saltea el primer paso.
  await expect(page).not.toHaveURL(/paso=oficio/);
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
});
