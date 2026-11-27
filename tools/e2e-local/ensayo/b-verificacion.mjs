// B. Verificación de identidad obligatoria.
import { kit, afirmar, igual, estado, contiene, turno, postular, asignar, esperar, avisos, texto, cuenta, tokenAdmin } from "./lib.mjs";

export const letra = "B";
export const titulo = "Verificación obligatoria";

export async function correr(ctx) {
  const com = await cuenta("employer", "b-bar", { fullName: "Dueño Ensayo B" });
  const marca = Math.random().toString(36).slice(2, 7);
  const nombreW = `Valeria Ensayo ${marca}`;
  const w = await cuenta("worker", "b-mozo", { fullName: nombreW });
  const t = await turno(com, { inicioH: 48 });
  let linkAdmin = null;
  let evidenciaId = null;

  await ctx.paso("Sin verificar, la persona puede postularse al turno", async () => {
    const r = await postular(w, t.id);
    estado(r, [200, 201], "postular sin verificar");
  }, { critico: true });

  await ctx.paso("Sin verificar, el comercio no puede elegirla: 409 con el mensaje «todavía no verificó su identidad»", async () => {
    const r = await asignar(com, t.id, w);
    estado(r, 409, "asignar sin verificar");
    contiene(r.data?.detail, /todavía no verificó su identidad/i, "el mensaje no es claro");
    contiene(r.data?.detail, /Elegí a otra|Cuando la verifique/i, "el mensaje no dice qué hacer");
    igual((await kit.api("GET", `/shifts/${t.id}`, { token: com.token })).data.status, "publicado", "el turno no debería haber cambiado");
  });

  const sc = await ctx.sesion({ name: "ens-b-comercio", viewport: "mobile", theme: "light" });
  await ctx.paso("UI · En Candidatos, al tocar «Elegir a Valeria» el comercio ve el mensaje claro y el turno sigue abierto", async () => {
    await kit.loginAs(sc.page, com);
    await sc.page.goto(`/shifts/${t.id}/candidates`);
    await sc.page.getByRole("button", { name: "Elegir a Valeria" }).click({ timeout: 15000 });
    await sc.page.getByText(/todavía no verificó su identidad/i).first().waitFor({ timeout: 10000 });
    await sc.shot("b-elegir-sin-verificar");
  });
  await ctx.pantallaLimpia(sc, "elegir sin verificación", [/\b409\b/]);

  const sw = await ctx.sesion({ name: "ens-b-persona", viewport: "mobile", theme: "light" });
  const pw = sw.page;
  await ctx.paso("UI · En Mis turnos → Postulaciones, la persona lee «Te falta verificar tu identidad»", async () => {
    await kit.loginAs(pw, w);
    await pw.goto("/my-shifts");
    await pw.getByRole("button", { name: "Postulaciones" }).click({ timeout: 15000 });
    const aviso = pw.getByTestId("falta-verificar");
    await aviso.waitFor({ timeout: 15000 });
    contiene(await aviso.innerText(), /Te falta verificar tu identidad/, "el cartel no dice que falta verificar");
    await sw.shot("b-mis-turnos-falta-verificar");
  });
  await ctx.pantallaLimpia(sw, "Mis turnos con el cartel de verificación");

  await ctx.paso("UI · Sube DNI (frente) y selfie desde el perfil y toca «Enviar a revisión»", async () => {
    await pw.goto("/profile");
    await pw.getByRole("button", { name: "Subir DNI (frente)" }).waitFor({ timeout: 15000 });
    const campo = (nombre) => pw.getByRole("button", { name: nombre }).locator("xpath=..").locator('input[type="file"]');
    const subida1 = kit.waitForUpload(pw);
    await campo("Subir DNI (frente)").setInputFiles(kit.assets.dniFrente);
    const r1 = await subida1;
    igual(r1.status, 200, "subida del DNI");
    await pw.getByRole("button", { name: "Cambiar DNI (frente)" }).waitFor({ timeout: 15000 });
    const subida2 = kit.waitForUpload(pw);
    await campo("Subir Selfie").setInputFiles(kit.assets.selfie);
    igual((await subida2).status, 200, "subida de la selfie");
    await pw.getByRole("button", { name: "Cambiar Selfie" }).waitFor({ timeout: 15000 });
    await sw.shot("b-documentos-cargados");
    await pw.getByRole("button", { name: "Enviar a revisión" }).click();
    await pw.getByText(/Estamos revisando tu documento/).waitFor({ timeout: 15000 });
    await sw.shot("b-en-revision");
  }, { critico: true });
  await ctx.pantallaLimpia(sw, "subir documentos y enviarlos");

  await ctx.paso("Mientras está en revisión, Mis turnos dice «Estamos revisando tu identidad» y sigue sin poder ser elegida", async () => {
    await pw.goto("/my-shifts");
    await pw.getByRole("button", { name: "Postulaciones" }).click({ timeout: 15000 });
    await pw.getByTestId("falta-verificar").waitFor({ timeout: 15000 });
    contiene(await pw.getByTestId("falta-verificar").innerText(), /Estamos revisando tu identidad/, "el cartel no refleja la revisión");
    estado(await asignar(com, t.id, w), 409, "asignar en revisión");
  });

  await ctx.paso("Los documentos no se ven sin el link firmado: ni la persona, ni un comercio, ni sin sesión piden el link (403/401)", async () => {
    const admTok = await tokenAdmin(2);
    const cola = estado(await kit.api("GET", "/identity/claims/pending", { token: admTok }), 200, "cola");
    const claim = cola.find((c) => c.user_id === w.userId);
    afirmar(claim, "no está en la cola");
    evidenciaId = claim.evidences[0].evidence_id;
    afirmar(claim.evidences.every((e) => e.available), "alguna evidencia figura como no disponible");
    igual((await kit.api("GET", `/identity/evidences/${evidenciaId}/link`, { token: w.token })).status, 403, "la dueña pidiendo su propio documento");
    igual((await kit.api("GET", `/identity/evidences/${evidenciaId}/link`, { token: com.token })).status, 403, "un comercio");
    igual((await kit.api("GET", `/identity/evidences/${evidenciaId}/link`)).status, 401, "sin sesión");
    const perfil = JSON.stringify((await kit.api("GET", "/identity/me", { token: w.token })).data);
    afirmar(!/cloudinary|public_id|https?:/i.test(perfil), `el estado de identidad de la persona expone una referencia al archivo: ${perfil.slice(0, 200)}`);
    const link = estado(await kit.api("GET", `/identity/evidences/${evidenciaId}/link`, { token: admTok }), 200, "link de la admin");
    linkAdmin = link.url;
    afirmar(link.expires_at, "el link no trae vencimiento");
    const vencimientoMin = (new Date(link.expires_at) - Date.now()) / 60000;
    afirmar(vencimientoMin > 0 && vencimientoMin <= 6, `el link debería vencer en ~5 min y vence en ${vencimientoMin.toFixed(1)}`);
  });
  await ctx.paso("El archivo se ve con el link firmado y da 401 sin la firma (original y transformado)", async () => {
    afirmar(linkAdmin, "no hay link");
    const aSim = (u) => u.replace(/^https:\/\/api\.cloudinary\.com/, "http://127.0.0.1:8901/cloudinary").replace(/^https:\/\/res\.cloudinary\.com/, "http://127.0.0.1:8901/res");
    const conFirma = await fetch(aSim(linkAdmin));
    igual(conFirma.status, 200, `archivo con el link firmado (${linkAdmin.slice(0, 160)})`);
    const url = new URL(aSim(linkAdmin));
    for (const k of ["signature", "api_key", "timestamp", "expires_at"]) url.searchParams.delete(k);
    igual((await fetch(url)).status, 401, `archivo sin firma (${url.toString().slice(0, 140)})`);
  });

  // ── La admin aprueba por la pantalla, con dos pasos ──
  let admin;
  await ctx.paso("UI · La admin entra con contraseña + código de la app (dos pasos) y llega al panel", async () => {
    admin = await ctx.admin(2, { viewport: "desktop", theme: "light" });
    afirmar(!admin.page.url().includes("/login"), "no salió del login");
  }, { critico: true });
  await ctx.paso("UI · En Verificación aparece la solicitud de Valeria con «Documento + selfie» y se la aprueba", async () => {
    await admin.page.goto("/admin/verificacion");
    const tarjeta = admin.page.locator(".tarjeta-suave", { hasText: nombreW }).first();
    await tarjeta.waitFor({ timeout: 20000 });
    contiene(await tarjeta.innerText(), "Documento + selfie", "la tarjeta no dice qué se revisa");
    await admin.shot("b-admin-cola");
    await tarjeta.getByRole("button", { name: "Aprobar" }).click();
    await admin.page.locator(".tarjeta-suave", { hasText: nombreW }).waitFor({ state: "detached", timeout: 15000 });
  }, { critico: true });
  await ctx.pantallaLimpia(admin, "la cola de verificación y la aprobación");

  await ctx.paso("Aprobada: ella recibe el aviso y el mail, el sello se ve y Mis turnos ya no pide verificar (UI)", async () => {
    await esperar(async () => (await avisos(w, "verification_decided")).length >= 1, "aviso de verificación", 15000);
    await kit.waitForMail(w.email, { subject: /Verificación aprobada/i, timeoutMs: 15000 });
    igual((await kit.api("GET", "/identity/me", { token: w.token })).data.identidad_verificada, true, "identidad_verificada");
    await pw.goto("/my-shifts");
    await pw.getByRole("button", { name: "Postulaciones" }).click({ timeout: 15000 });
    await pw.waitForTimeout(1500);
    afirmar((await pw.getByTestId("falta-verificar").count()) === 0, "el cartel de verificación sigue apareciendo");
    await pw.goto("/profile");
    await pw.getByText(/verificada/i).first().waitFor({ timeout: 15000 });
    await sw.shot("b-verificada");
  });
  await ctx.pantallaLimpia(sw, "perfil y Mis turnos ya verificada");

  await ctx.paso("Los documentos se borran al decidir: el link ya no sirve (404)", async () => {
    const admTok = await tokenAdmin(2);
    const r = await kit.api("GET", `/identity/evidences/${evidenciaId}/link`, { token: admTok });
    igual(r.status, 404, "link de una evidencia ya decidida");
  });

  await ctx.paso("Después de verificada, sí se la puede elegir", async () => {
    const r = await asignar(com, t.id, w);
    estado(r, 200, "asignar verificada");
    igual(r.data.status, "asignado", "estado");
  });
  await ctx.paso("UI · El comercio recarga Candidatos y ve que la elegida quedó asignada", async () => {
    await sc.page.goto("/shifts");
    await sc.page.waitForLoadState("networkidle").catch(() => {});
    contiene(await texto(sc.page), /Valeria/, "el panel no muestra a la persona asignada");
    await sc.shot("b-panel-asignada");
  });
  await ctx.pantallaLimpia(sc, "panel tras asignar");
}
