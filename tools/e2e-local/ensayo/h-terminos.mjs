// H. Términos nuevos: quien aceptó una versión vieja ve el cartel y no sigue sin aceptar.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kit, afirmar, igual, estado, contiene, cuenta, texto } from "./lib.mjs";

export const letra = "H";
export const titulo = "Términos nuevos";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(aqui, "..", "..", "..");

export async function correr(ctx) {
  const versionFront = /LEGAL_TERMS_VERSION = "([^"]+)"/.exec(fs.readFileSync(path.join(repo, "frontend/lib/legal.ts"), "utf8"))?.[1];
  const versionBack = /LEGAL_TERMS_VERSION = "([^"]+)"/.exec(fs.readFileSync(path.join(repo, "backend/app/modules/identity/domain/value_objects.py"), "utf8"))?.[1];
  await ctx.paso("La versión de los Términos coincide entre frontend y backend", async () => {
    afirmar(versionFront && versionBack, "no se pudo leer alguna de las dos versiones");
    igual(versionFront, versionBack, "versión de Términos (frontend vs backend)");
  });

  const w = await cuenta("worker", "h-mozo", { fullName: "Hilda Términos" });
  await ctx.paso("Una cuenta nueva queda con los Términos vigentes aceptados (constancia con versión y medio)", async () => {
    const f = kit.db(`select version, channel from terms_acceptances where user_id = '${w.userId}'`);
    igual(f.length, 1, "constancias");
    igual(f[0].version, versionBack, "versión aceptada");
    afirmar(f[0].channel, "falta el medio de aceptación");
    const me = estado(await kit.api("GET", "/auth/me", { token: w.token }), 200, "me");
    igual(me.terms_acceptance_required, false, "no debería pedir aceptar");
  });

  await ctx.paso("Cambian los Términos (db(), fila propia: la constancia de Hilda pasa a una versión vieja)", async () => {
    kit.db(`update terms_acceptances set version = '2020-01-01-1' where user_id = '${w.userId}'`);
    const me = estado(await kit.api("GET", "/auth/me", { token: w.token }), 200, "me");
    igual(me.terms_acceptance_required, true, "el backend debería pedir aceptar");
  });

  const s = await ctx.sesion({ name: "ens-h-persona", viewport: "mobile", theme: "light", skipTours: false });
  const p = s.page;
  const cartel = p.getByRole("dialog", { name: "Actualizamos los Términos" });
  await ctx.paso("UI · Al entrar aparece «Actualizamos los Términos» con links a Términos y Privacidad, sin recargar", async () => {
    await p.goto("/login");
    await p.locator('input[name="email"]').fill(w.email);
    await p.locator('input[name="password"]').fill(w.password);
    await p.getByRole("button", { name: "Ingresar", exact: true }).click();
    await cartel.waitFor({ timeout: 15000 });
    contiene(await cartel.innerText(), /Términos y Condiciones/, "el cartel no nombra los Términos");
    afirmar((await cartel.getByRole("link", { name: "Política de Privacidad" }).count()) === 1, "falta el link a la Política de Privacidad");
    await s.shot("h-cartel-claro");
  }, { critico: true });
  await ctx.paso("UI · No se puede seguir sin aceptar: Escape, tocar afuera y navegar a otras pantallas no lo sacan", async () => {
    await p.keyboard.press("Escape");
    await p.waitForTimeout(500);
    afirmar(await cartel.isVisible(), "Escape cerró el cartel");
    await p.mouse.click(5, 5);
    await p.waitForTimeout(500);
    afirmar(await cartel.isVisible(), "tocar afuera cerró el cartel");
    for (const ruta of ["/my-shifts", "/profile", "/feed"]) {
      await p.goto(ruta);
      await p.waitForLoadState("networkidle").catch(() => {});
      await cartel.waitFor({ timeout: 10000 }).catch(() => {});
      afirmar(await cartel.isVisible(), `en ${ruta} el cartel no está`);
    }
    // Lo de abajo no responde mientras el cartel está: un toque en la barra inferior no navega.
    await p.getByRole("link", { name: "Turnos" }).click({ timeout: 2000, force: true }).catch(() => {});
    await p.waitForTimeout(500);
    afirmar(await cartel.isVisible(), "el cartel desapareció al tocar la barra inferior");
  });
  await ctx.paso("UI · El recorrido guiado de bienvenida espera: no tapa el botón «Acepto»", async () => {
    const tapado = await p.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Acepto");
      if (!b) return "no hay botón";
      const r = b.getBoundingClientRect();
      const arriba = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return b.contains(arriba) ? "libre" : `tapado por ${arriba?.tagName}.${(arriba?.className || "").toString().slice(0, 40)}`;
    });
    igual(tapado, "libre", "el botón «Acepto»");
  });
  await ctx.pantallaLimpia(s, "el cartel de Términos nuevos");

  await ctx.paso("UI · Al tocar «Acepto» el cartel se va, queda la constancia con la versión vigente y no vuelve al recargar", async () => {
    await cartel.getByRole("button", { name: "Acepto" }).click();
    await cartel.waitFor({ state: "detached", timeout: 10000 });
    const filas = kit.db(`select version from terms_acceptances where user_id = '${w.userId}' order by accepted_at`);
    igual(filas.at(-1).version, versionBack, "última versión aceptada");
    igual(filas.length, 2, "constancias (la vieja se conserva y se suma la nueva)");
    await p.reload();
    await p.waitForLoadState("networkidle").catch(() => {});
    await p.waitForTimeout(1500);
    afirmar((await cartel.count()) === 0, "el cartel volvió después de recargar");
    await s.shot("h-despues-de-aceptar");
  });
  await ctx.pantallaLimpia(s, "aceptar los Términos nuevos");

  // Tema oscuro y «Cerrar sesión»
  const w2 = await cuenta("worker", "h-oscuro", { fullName: "Oscar Términos" });
  kit.db(`update terms_acceptances set version = '2020-01-01-1' where user_id = '${w2.userId}'`);
  const s2 = await ctx.sesion({ name: "ens-h-oscuro", viewport: "mobile", theme: "dark" });
  await ctx.paso("UI · En tema oscuro el cartel se ve (captura) y «Cerrar sesión» saca a la persona sin aceptar", async () => {
    const c2 = s2.page.getByRole("dialog", { name: "Actualizamos los Términos" });
    await kit.loginAs(s2.page, w2).catch(() => {});
    await c2.waitFor({ timeout: 15000 });
    await s2.shot("h-cartel-oscuro");
    await c2.getByRole("button", { name: "Cerrar sesión" }).click();
    await s2.page.waitForURL((u) => /login|^\/$/.test(u.pathname) || u.pathname === "/", { timeout: 15000 });
    igual(kit.db(`select version from terms_acceptances where user_id = '${w2.userId}'`)[0].version, "2020-01-01-1", "no debería haberse registrado aceptación");
  });

  await ctx.paso("Servidor: con los Términos viejos el backend sigue dejando operar a la cuenta (el bloqueo es sólo de pantalla)", async () => {
    // Observación, no regla: el producto promete «para seguir usando Oído necesitamos que los aceptes».
    const r = await kit.api("GET", "/shifts/feed", { token: w2.token });
    ctx.nota(`GET /shifts/feed con Términos viejos sin aceptar → ${r.status} (el cartel es del frontend; el backend sólo informa terms_acceptance_required)`);
  });
}
