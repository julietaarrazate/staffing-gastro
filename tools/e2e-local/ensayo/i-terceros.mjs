// I. Fallas de terceros: IA, subida de archivos, mails y direcciones.
import fs from "node:fs";
import path from "node:path";
import { kit, afirmar, igual, estado, contiene, cuenta, texto, esperar, aFechaLocal } from "./lib.mjs";

export const letra = "I";
export const titulo = "Fallas de terceros";

export async function correr(ctx) {
  // ── IA («Describilo y lo completamos») ──
  const com = await cuenta("employer", "i-bar", { fullName: "Dueño Ensayo I" });
  const sc = await ctx.sesion({ name: "ens-i-comercio", viewport: "mobile", theme: "light" });
  const p = sc.page;
  await kit.loginAs(p, com);
  const describir = async (texto_) => {
    await p.goto("/shifts/new");
    await p.getByPlaceholder(/necesito un mozo el sábado/).fill(texto_);
    await p.getByRole("button", { name: "Completar" }).click();
  };

  await ctx.paso("UI · IA funcionando (control): «necesito un mozo el sábado a la noche, se paga 45000» completa lo que entiende y pregunta lo que falta", async () => {
    await describir("necesito un mozo el sábado a la noche, se paga 45000");
    await p.getByText(/Completamos|falta|Faltó|Todavía falta/i).first().waitFor({ timeout: 20000 });
    await sc.shot("i-ia-ok");
  });
  await ctx.pantallaLimpia(sc, "«Describilo» con la IA funcionando");

  await ctx.paso("UI · IA caída (503): mensaje «La IA no está disponible… Completá los datos a mano» y el asistente sigue usable a mano", async () => {
    await describir("E1_IA_CAIDA necesito un mozo para el viernes");
    await p.getByText(/La IA no está disponible/).first().waitFor({ timeout: 20000 });
    await sc.shot("i-ia-caida");
    // Sigue usable: se elige el puesto a mano y se avanza.
    await p.getByRole("button", { name: "Mozo/a" }).click({ timeout: 10000 });
    await p.locator("input[type=datetime-local]").first().waitFor({ timeout: 10000 });
  });
  await ctx.pantallaLimpia(sc, "IA caída", [/\b503\b/, /Failed to load resource.*503/]);

  await ctx.paso("UI · IA con respuesta inválida (502): mensaje «No pudimos interpretar el texto. Completá los datos a mano» y se puede seguir", async () => {
    await describir("E1_IA_INVALIDA necesito un mozo para el viernes");
    await p.getByText(/No pudimos interpretar el texto/).first().waitFor({ timeout: 20000 });
    await sc.shot("i-ia-invalida");
    await p.getByRole("button", { name: "Mozo/a" }).click({ timeout: 10000 });
    await p.locator("input[type=datetime-local]").first().waitFor({ timeout: 10000 });
  });
  await ctx.pantallaLimpia(sc, "IA inválida", [/\b502\b/, /Failed to load resource.*502/]);

  await ctx.paso("UI · IA lenta (8 s): el botón muestra que está trabajando, no se duplica el pedido y al final completa", async () => {
    await p.goto("/shifts/new");
    let pedidos = 0;
    p.on("request", (r) => r.url().includes("/shifts/parse-text") && pedidos++);
    await p.getByPlaceholder(/necesito un mozo el sábado/).fill("E1_IA_LENTA necesito un mozo el sábado a la noche, se paga 45000");
    const boton = p.getByRole("button", { name: "Completar" });
    await boton.click();
    await p.waitForTimeout(1500);
    afirmar((await p.getByText(/Leyendo tu pedido/).count()) >= 1, "mientras la IA tarda no se ve que está trabajando («Leyendo tu pedido…»)");
    await sc.shot("i-ia-lenta-esperando");
    await p.mouse.click(332, 478).catch(() => {});
    await p.getByText(/Completamos|falta/i).first().waitFor({ timeout: 25000 });
    igual(pedidos, 1, "pedidos a la IA (el segundo toque no debería duplicarlo)");
  });
  await ctx.pantallaLimpia(sc, "IA lenta");

  // ── Direcciones ──
  const nuevo = await cuenta("employer", "i-sinperfil", { profile: false });
  const s2 = await ctx.sesion({ name: "ens-i-direccion", viewport: "mobile", theme: "light" });
  await kit.loginAs(s2.page, nuevo);
  await s2.page.goto("/bienvenida");
  await s2.page.locator('input[placeholder="Ej: Bar El Patio"]').fill("Bar Dirección Ensayo");
  await s2.page.getByRole("button", { name: "Continuar" }).click();
  const buscar = s2.page.getByPlaceholder("Buscá la dirección de tu local");
  await ctx.paso("UI · Dirección sin resultados («zzzz»): lo dice con claridad y ofrece cargarla a mano", async () => {
    await buscar.fill("zzzz");
    await s2.page.getByText(/No encontramos|sin resultados|No hay resultados|no encontr/i).first().waitFor({ timeout: 15000 });
    await s2.shot("i-direccion-sin-resultados");
    afirmar((await s2.page.getByRole("button", { name: /Cargala a mano/ }).count()) >= 1, "no ofrece cargarla a mano");
  });
  await ctx.paso("UI · Servicio de direcciones caído («e1error»): mensaje claro, no se rompe la pantalla", async () => {
    await buscar.fill("e1error");
    await s2.page.getByText(/No pudimos conectarnos al buscador de direcciones/).first().waitFor({ timeout: 15000 });
    await s2.shot("i-direccion-caida");
  });
  await ctx.paso("UI · Con el servicio caído se puede terminar eligiendo provincia y barrio con «Usar selector manual»", async () => {
    await s2.page.getByText("Usar selector manual").click();
    await s2.page.locator("select").nth(1).selectOption({ label: "Palermo" });
    await s2.page.getByRole("button", { name: "Terminar" }).click();
    await s2.page.waitForURL(/\/shifts/, { timeout: 20000 });
    const tok = (await kit.api("POST", "/auth/login", { body: { email: nuevo.email, password: nuevo.password } })).data.access_token;
    const perfil = estado(await kit.api("GET", "/companies/me/profile", { token: tok }), 200, "perfil");
    afirmar(perfil.latitude != null && /Palermo/.test(perfil.city || ""), `el barrio elegido no quedó guardado (city=${perfil.city}, lat=${perfil.latitude})`);
  });
  await ctx.pantallaLimpia(s2, "direcciones sin resultados / caídas / a mano", [/e1error|nominatim|geocod|Failed to load resource|\b5\d\d\b/i, /companies\/me\/profile/]);

  // ── Subida de archivos ──
  const w = await cuenta("worker", "i-mozo", { fullName: "Ivana Archivos" });
  const sw = await ctx.sesion({ name: "ens-i-archivos", viewport: "mobile", theme: "light" });
  const pw = sw.page;
  const fallida = path.join(kit.assets.foto, "..", "dni-e1fail.jpg");
  if (!fs.existsSync(fallida)) fs.copyFileSync(kit.assets.dniFrente, fallida);
  await kit.loginAs(pw, w);
  await pw.goto("/profile");
  const campo = pw.getByRole("button", { name: "Subir DNI (frente)" }).locator("xpath=..").locator('input[type="file"]');
  await pw.getByRole("button", { name: "Subir DNI (frente)" }).waitFor({ timeout: 15000 });
  await ctx.paso("UI · Archivo demasiado grande (11 MB): mensaje «demasiado pesado… máximo 10MB» y no se sube nada", async () => {
    await campo.setInputFiles(kit.assets.grande);
    await pw.getByText(/demasiado pesado/).first().waitFor({ timeout: 10000 });
    afirmar((await pw.getByRole("button", { name: "Cambiar DNI (frente)" }).count()) === 0, "quedó cargado un archivo que no debía");
    await sw.shot("i-subida-grande");
  });
  await ctx.paso("UI · Archivo que no es imagen (.txt): mensaje «Ese tipo de archivo no está permitido»", async () => {
    await campo.setInputFiles(kit.assets.texto);
    await pw.getByText(/no está permitido/).first().waitFor({ timeout: 10000 });
    await sw.shot("i-subida-tipo");
  });
  await ctx.paso("UI · Subida que falla en el tercero (500 de Cloudinary): mensaje «No se pudo subir» y el botón sigue disponible para reintentar", async () => {
    await campo.setInputFiles(fallida);
    await pw.getByText(/No se pudo subir|No pudimos subir|Probá de nuevo/).first().waitFor({ timeout: 20000 });
    afirmar(await pw.getByRole("button", { name: "Subir DNI (frente)" }).isEnabled(), "el botón de subir quedó trabado después del error");
    await sw.shot("i-subida-falla");
  });
  await ctx.paso("UI · Después de los errores, el mismo campo acepta un archivo correcto", async () => {
    await campo.setInputFiles(kit.assets.dniFrente);
    await pw.getByRole("button", { name: "Cambiar DNI (frente)" }).waitFor({ timeout: 20000 });
    afirmar((await pw.getByText(/demasiado pesado|no está permitido|No se pudo subir/).count()) === 0, "quedó un mensaje de error viejo en pantalla");
  });
  await ctx.pantallaLimpia(sw, "subida de archivos con errores", [/e1fail|cloudinary|upload|Failed to load resource|\b(400|413|500)\b/i]);

  // ── Mails que rebotan ──
  const mailMalo = kit.uniq("ens-i-e1bounce");
  const sm = await ctx.sesion({ name: "ens-i-mail", viewport: "mobile", theme: "light" });
  await ctx.paso("UI · Registro con un mail que rebota: la cuenta se crea igual y la persona entra a la app (no ve un error 500)", async () => {
    const q = sm.page;
    await q.goto("/register");
    await q.getByRole("button", { name: "Soy trabajador/a" }).click();
    await q.locator('input[name="name"]').fill("Rebote Ensayo");
    await q.locator('input[name="bday"]').fill("1990-01-01");
    await q.locator('input[name="email"]').fill(mailMalo);
    await q.locator('input[name="new-password"]').fill(kit.DEFAULT_PASSWORD);
    await q.locator("input[type=checkbox]").check();
    await q.getByRole("button", { name: "Crear cuenta" }).click();
    await q.waitForURL(/\/bienvenida|\/feed/, { timeout: 20000 });
    await sm.shot("i-registro-mail-rebota");
    afirmar((await kit.mailbox(mailMalo)).length === 0, "el simulado no debería haber guardado el mail");
  });
  await ctx.paso("Con el mail rebotado, la app le avisa a la persona que el mail no salió (hoy dice «Te mandamos un mail»)", async () => {
    const t = await texto(sm.page);
    afirmar(!/Te mandamos un mail para confirmar/.test(t) || /no pudimos enviar|no salió|revisá que (el|tu) (mail|email)|corregí/i.test(t), `la pantalla afirma que se mandó un mail que nunca salió: «${t.slice(0, 200)}»`);
  });
  await ctx.paso("«Reenviar verificación» y «Olvidé mi contraseña» con ese mail no devuelven error ni revelan si la cuenta existe (202)", async () => {
    const a = await kit.api("POST", "/auth/resend-verification", { body: { email: mailMalo } });
    igual(a.status, 202, "reenviar verificación");
    const b = await kit.api("POST", "/auth/forgot-password", { body: { email: mailMalo } });
    igual(b.status, 202, "olvidé mi contraseña");
    const c = await kit.api("POST", "/auth/forgot-password", { body: { email: kit.uniq("ens-i-noexiste") } });
    igual(c.status, 202, "olvidé mi contraseña con un mail inexistente");
    igual(JSON.stringify(b.data), JSON.stringify(c.data), "la respuesta no debería distinguir si la cuenta existe");
  });
  await ctx.paso("Los mails que sí salen no se frenan por un rebote anterior: otra cuenta recibe su mail de confirmación", async () => {
    const otro = kit.uniq("ens-i-bueno");
    estado(await kit.api("POST", "/auth/register", { body: { email: otro, password: kit.DEFAULT_PASSWORD, full_name: "Buena Ensayo", role: "worker", accepted_terms: true, birth_date: "1990-01-01" } }), 201, "registro");
    await kit.waitForMail(otro, { subject: /Confirm[aá] tu email/i, timeoutMs: 15000 });
  });
  await ctx.pantallaLimpia(sm, "registro con mail que rebota", [/\b4\d\d\b/, /Failed to load resource/]);

  ctx.noCubierto("Rebote real del mail (bounce asincrónico de Resend)", "el simulado sólo reproduce el rechazo síncrono (422); el rebote que avisa Resend más tarde por webhook no existe en el arnés.");
}
