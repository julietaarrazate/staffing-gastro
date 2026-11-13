import { test, expect, type Page } from "@playwright/test";
import { blockExternalHosts, skipSplash } from "./mocks";

/**
 * Una dirección que no existe muestra la pantalla propia, en castellano y con
 * salida (`app/not-found.tsx`). Antes salía la de Next: «404 | This page could
 * not be found.», en inglés y sin ningún botón.
 *
 * Los dos casos de acá no le piden nada a la API, así que corren en CI sin
 * backend. El link de un turno que ya se tomó («Este turno ya no está
 * disponible») sí depende de lo que conteste la API desde el servidor, que
 * `page.route` no intercepta: lo cubren `components/TurnoNoDisponible.test.tsx`,
 * `lib/turno-publico.test.ts` y `app/turno/[id]/turno.test.tsx`.
 */

async function sinSesion(page: Page) {
  await skipSplash(page);
  await blockExternalHosts(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" })
  );
}

const CASOS = [
  { nombre: "una dirección que no existe", ruta: "/esta-pagina-no-existe" },
  // Un id que no es un turno posible: se corta antes de preguntarle a la API.
  { nombre: "el link de un turno con un id inválido", ruta: "/turno/no-es-un-turno" },
];

for (const { nombre, ruta } of CASOS) {
  test(`${nombre} muestra «No encontramos esa página» y deja volver al inicio`, async ({ page }) => {
    await sinSesion(page);
    const respuesta = await page.goto(ruta);
    expect(respuesta?.status()).toBe(404);

    await expect(
      page.getByRole("heading", { level: 1, name: "No encontramos esa página" })
    ).toBeVisible();
    await expect(page.getByText("This page could not be found")).toHaveCount(0);
    await expect(page).toHaveTitle("Página no encontrada — Oído");

    // Entra en 390 px sin scroll horizontal.
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(desborde).toBeLessThanOrEqual(0);

    await page.getByRole("link", { name: "Volver al inicio" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
}
