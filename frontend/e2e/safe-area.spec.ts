import { test, expect } from "@playwright/test";
import { skipSplash } from "./mocks";

/**
 * Regresión de área segura (notch / indicador de home del iPhone).
 *
 * El repo ya consumía `env(safe-area-inset-*)` en `BottomNav`, `Sheet` y las
 * utilidades `.safe-top`/`.safe-bottom`, pero **el viewport nunca declaraba
 * `viewport-fit=cover`** — y sin eso iOS resuelve todos esos insets a `0`.
 * O sea: todo el código de safe-area del proyecto estaba muerto y la barra
 * inferior se dibujaba debajo del indicador de home.
 *
 * No se puede simular el notch en Chromium headless, así que el test verifica
 * la causa raíz que sí es observable: que el meta viewport servido lleve
 * `viewport-fit=cover`. Sin eso, nada del resto puede funcionar.
 */
test("el viewport declara viewport-fit=cover (sin esto los safe-area insets valen 0 en iOS)", async ({
  page,
}) => {
  await skipSplash(page);
  await page.goto("/login");

  const content = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");

  expect(content).toContain("viewport-fit=cover");
});
