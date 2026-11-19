import { test, expect } from "@playwright/test";
import { blockExternalHosts, injectSession, mockEmptyNotifications } from "./mocks";

/**
 * El formulario de perfil sólo manda lo que la persona tocó: si otra pantalla
 * cambió «Disponible» o la zona mientras el formulario estaba abierto, guardar
 * otro campo no lo revierte (ESC-03, 2026-11-19).
 */

const PERFIL = {
  id: "profile-1",
  user_id: "user-1",
  full_name: "Mozo Demo",
  photo_url: null,
  birth_date: null,
  age: null,
  city: "Palermo, CABA",
  bio: "Descripción vieja",
  latitude: -34.5875,
  longitude: -58.4257,
  skills: ["mozo"],
  years_experience: 2,
  languages: [],
  certifications: [],
  cv_file: null,
  cv_url: null,
  cv_filename: null,
  is_available: true,
};

test("guardar la descripción no revierte «Disponible» ni la zona cambiados en otro lado", async ({ page }) => {
  await injectSession(page);
  await blockExternalHosts(page);
  await mockEmptyNotifications(page);
  const json = (body: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill(
      json({
        id: "user-1",
        email: "demo@staffya.com",
        full_name: "Mozo Demo",
        role: "worker",
        status: "activo",
        is_active: true,
        is_verified: true,
      })
    )
  );

  let servidor: Record<string, unknown> = PERFIL;
  let body: Record<string, unknown> | null = null;
  await page.route("**/api/v1/workers/me/profile", (route) => {
    if (route.request().method() === "PUT") {
      body = route.request().postDataJSON();
      servidor = { ...servidor, ...body };
      return route.fulfill(json(servidor));
    }
    return route.fulfill(json(servidor));
  });

  await page.goto("/profile/edit");
  const bio = page.getByLabel("Sobre mí");
  await expect(bio).toHaveValue("Descripción vieja");

  // Mientras el formulario está abierto, otra pantalla guarda.
  servidor = {
    ...PERFIL,
    is_available: false,
    city: "Rosario, Santa Fe",
    latitude: -32.95,
    longitude: -60.64,
  };

  await bio.fill("Descripción nueva");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Perfil guardado")).toBeVisible();

  expect(body).toMatchObject({
    bio: "Descripción nueva",
    is_available: false,
    city: "Rosario, Santa Fe",
    latitude: -32.95,
    longitude: -60.64,
  });
});
