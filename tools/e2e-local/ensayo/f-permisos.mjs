// F. No-disclosure y permisos: lo ajeno no existe (404), las rutas de admin están cerradas.
import { kit, afirmar, igual, estado, contiene, turno, postular, confirmado, cuenta, tokenAdmin, verificarPorApi, hora, texto } from "./lib.mjs";

export const letra = "F";
export const titulo = "No-disclosure y permisos";

export async function correr(ctx) {
  const admTok = await tokenAdmin(5);
  const c1 = await cuenta("employer", "f-uno", { fullName: "Dueño Uno Ensayo" });
  const c2 = await cuenta("employer", "f-dos", { fullName: "Dueño Dos Ensayo" });
  const w1 = await cuenta("worker", "f-w1", { fullName: "Wanda Privada Ensayo" });
  const w2 = await cuenta("worker", "f-w2", { fullName: "Walter Ajeno Ensayo" });
  await verificarPorApi(w1, admTok);
  const tomado = await confirmado(c1, w1, { inicioH: 30 });
  const abierto = await turno(c1, { inicioH: 50 });
  await kit.api("POST", `/chats/${tomado.id}/messages`, { token: c1.token, body: { body: "Mensaje privado Uno-Wanda" } });

  const tabla = async (titulo_, filas) =>
    ctx.paso(titulo_, async () => {
      const malas = [];
      for (const [nombre, metodo, ruta, token, body, esperados] of filas) {
        const r = await kit.api(metodo, ruta, { token, body });
        const ok = esperados.includes(r.status);
        if (!ok) malas.push(`${nombre}: esperaba ${esperados.join("/")} y vino ${r.status}`);
      }
      afirmar(!malas.length, malas.join(" · "));
    });

  await tabla("Un comercio ajeno no ve ni toca turnos de otro: ver, editar, publicar, cancelar, asignar, cerrar, pagar, ausencia y «Ya llegó» dan 404", [
    ["ver turno", "GET", `/shifts/${tomado.id}`, c2.token, undefined, [404]],
    ["editar turno", "PUT", `/shifts/${tomado.id}`, c2.token, { position: "mozo", quantity: 1, start_at: hora(40), end_at: hora(45), pay_amount: "1" }, [404]],
    ["publicar", "POST", `/shifts/${tomado.id}/publish`, c2.token, undefined, [404]],
    ["cancelar", "POST", `/shifts/${tomado.id}/cancel`, c2.token, undefined, [404]],
    ["asignar", "POST", `/shifts/${abierto.id}/assign`, c2.token, { worker_profile_id: w2.profile.id }, [404]],
    ["cerrar", "POST", `/shifts/${tomado.id}/finish`, c2.token, undefined, [404]],
    ["marcar pagado", "POST", `/shifts/${tomado.id}/mark-paid`, c2.token, undefined, [404]],
    ["no se presentó", "POST", `/shifts/${tomado.id}/no-show`, c2.token, undefined, [404]],
    ["ya llegó", "POST", `/shifts/${tomado.id}/company-check-in`, c2.token, { on_time: true }, [404]],
  ]);
  await tabla("Un comercio ajeno no ve los postulantes ni los candidatos de otro (404)", [
    ["postulantes", "GET", `/applications/shifts/${abierto.id}`, c2.token, undefined, [404]],
    ["recomendados", "GET", `/shifts/${abierto.id}/candidates`, c2.token, undefined, [404]],
  ]);
  await tabla("Un comercio ajeno no lee ni escribe en el chat ni en las reseñas de un turno que no es suyo (404)", [
    ["leer chat", "GET", `/chats/${tomado.id}/messages`, c2.token, undefined, [404]],
    ["escribir chat", "POST", `/chats/${tomado.id}/messages`, c2.token, { body: "intruso" }, [404]],
    ["ver reseñas del turno", "GET", `/reviews/shifts/${tomado.id}`, c2.token, undefined, [404]],
    ["calificar", "POST", `/reviews/shifts/${tomado.id}`, c2.token, { rating: 1 }, [404]],
  ]);
  await tabla("Una persona ajena no ve el turno ya tomado ni toca su flujo (404): confirmar, rechazar, cancelar, salir, llegar, reconfirmar", [
    ["ver turno tomado", "GET", `/shifts/${tomado.id}`, w2.token, undefined, [404]],
    ["confirmar", "POST", `/shifts/${tomado.id}/confirm`, w2.token, undefined, [404]],
    ["rechazar", "POST", `/shifts/${tomado.id}/reject`, w2.token, undefined, [404]],
    ["cancelar asignación", "POST", `/shifts/${tomado.id}/worker-cancel`, w2.token, undefined, [404]],
    ["reconfirmar", "POST", `/shifts/${tomado.id}/reconfirm`, w2.token, undefined, [404]],
    ["salir", "POST", `/shifts/${tomado.id}/depart`, w2.token, undefined, [404]],
    ["llegar", "POST", `/shifts/${tomado.id}/check-in`, w2.token, { latitude: -34.58755, longitude: -58.43095 }, [404]],
    ["postularse a uno tomado", "POST", `/applications/shifts/${tomado.id}`, w2.token, undefined, [404]],
    ["calificar", "POST", `/reviews/shifts/${tomado.id}`, w2.token, { rating: 5 }, [404]],
  ]);
  await tabla("Una persona ajena no ve chats ajenos (404) ni la lista de postulantes (403, es de comercio)", [
    ["leer chat", "GET", `/chats/${tomado.id}/messages`, w2.token, undefined, [404]],
    ["escribir chat", "POST", `/chats/${tomado.id}/messages`, w2.token, { body: "intruso" }, [404]],
    ["postulantes", "GET", `/applications/shifts/${abierto.id}`, w2.token, undefined, [403]],
  ]);
  await ctx.paso("Sin sesión no se ve nada privado: chat, turno propio y avisos dan 401", async () => {
    for (const ruta of [`/chats/${tomado.id}/messages`, `/shifts/${tomado.id}`, "/notifications", "/shifts/me", "/workers/me/profile"]) {
      igual((await kit.api("GET", ruta)).status, 401, `GET ${ruta} sin sesión`);
    }
  });
  await ctx.paso("El chat privado no se filtra a la lista de conversaciones ni a los avisos de terceros", async () => {
    const lista2 = estado(await kit.api("GET", "/chats", { token: w2.token }), 200, "chats de la persona ajena");
    afirmar(!JSON.stringify(lista2).includes("Mensaje privado"), "la lista de chats de otra persona trae el mensaje");
    const lista3 = estado(await kit.api("GET", "/chats", { token: c2.token }), 200, "chats del comercio ajeno");
    afirmar(!JSON.stringify(lista3).includes("Mensaje privado"), "la lista de chats de otro comercio trae el mensaje");
    const av = await kit.api("GET", "/notifications", { token: w2.token });
    afirmar(!JSON.stringify(av.data).includes("Mensaje privado"), "un aviso de otra persona trae el mensaje");
    const n = (await kit.api("GET", "/notifications", { token: w1.token })).data[0];
    igual((await kit.api("POST", `/notifications/${n.id}/read`, { token: w2.token })).status, 404, "marcar como leído un aviso ajeno");
  });
  await ctx.paso("Los datos de contacto de una persona no salen a otros: ni email ni teléfono ni fecha de nacimiento ni coordenadas exactas", async () => {
    for (const [quien, token] of [["otra persona", w2.token], ["un comercio sin relación", c2.token]]) {
      const r = estado(await kit.api("GET", `/workers/${w1.profile.id}`, { token }), 200, `perfil visto por ${quien}`);
      const crudo = JSON.stringify(r);
      afirmar(!/@e1\.test|@/.test(crudo.replace(/"bio":"[^"]*"/, "")), `el perfil visto por ${quien} trae un email: ${crudo.slice(0, 200)}`);
      afirmar(!/phone|telefono|teléfono|whatsapp/i.test(Object.keys(r).join(",")), `el perfil trae un teléfono (${Object.keys(r).join(",")})`);
      afirmar(r.birth_date == null && r.latitude == null && r.longitude == null, `el perfil visto por ${quien} trae fecha de nacimiento o coordenadas (birth_date=${r.birth_date}, lat=${r.latitude})`);
    }
    const emp = estado(await kit.api("GET", `/companies/${c1.profile.id}`, { token: w2.token }), 200, "perfil del comercio");
    afirmar(!/@/.test(JSON.stringify(emp)), "el perfil del comercio trae un email");
  });
  await ctx.paso("El CV de una persona no lo bajan ni otras personas ni comercios sin relación (404)", async () => {
    igual((await kit.api("GET", `/workers/${w1.profile.id}/cv-link`, { token: w2.token })).status, 404, "otra persona");
    igual((await kit.api("GET", `/workers/${w1.profile.id}/cv-link`, { token: c2.token })).status, 404, "comercio sin relación");
  });
  await tabla("Rutas de admin cerradas a persona y a comercio (403) y a quien no inició sesión (401)", [
    ...[["métricas", "/admin/stats"], ["usuarios", "/admin/users"], ["hoy", "/admin/today"], ["turnos en vivo", "/admin/live-shifts"], ["métricas por período", "/admin/period-metrics"], ["cuentas de prueba", "/admin/test-accounts"], ["leads", "/admin/leads"], ["cola de verificación", "/identity/claims/pending"], ["tickets de soporte (cola)", "/support/tickets"]].flatMap(([n, ruta]) => [
      [`persona · ${n}`, "GET", ruta, w2.token, undefined, [403]],
      [`comercio · ${n}`, "GET", ruta, c2.token, undefined, [403]],
      [`sin sesión · ${n}`, "GET", ruta, undefined, undefined, [401]],
    ]),
    ["persona · ficha de usuario", "GET", `/admin/users/${w1.userId}`, w2.token, undefined, [403]],
    ["comercio · suspender", "POST", `/admin/users/${w1.userId}/suspend`, c2.token, {}, [403]],
    ["comercio · ver como", "POST", `/admin/users/${w1.userId}/impersonate`, c2.token, undefined, [403]],
    ["persona · promover a admin", "POST", `/admin/users/${w2.userId}/promote`, w2.token, undefined, [403]],
    ["comercio · cerrar turno ajeno", "POST", `/admin/shifts/${tomado.id}/close`, c2.token, undefined, [403]],
    ["persona · aprobar identidad propia", "POST", `/identity/claims/00000000-0000-0000-0000-000000000000/approve`, w2.token, undefined, [403]],
  ]);

  await ctx.paso("La página pública del turno abierto no trae datos personales: ni quién se postuló, ni emails, ni coordenadas de la persona (API y HTML sin sesión)", async () => {
    await postular(w2, abierto.id);
    const r = estado(await kit.api("GET", `/shifts/${abierto.id}/public`), 200, "página pública");
    const campos = Object.keys(r);
    afirmar(!campos.some((k) => /worker|applicant|email|phone|latitude|longitude|address|user/i.test(k)), `la página pública expone campos de más: ${campos.join(",")}`);
    const html = await (await fetch(`http://localhost:3100/turno/${abierto.id}`)).text();
    afirmar(!/Walter Ajeno|Wanda Privada|@e1\.test/.test(html), "el HTML público nombra a una persona o muestra un email");
  });
  await ctx.paso("Cuando el turno ya se tomó, la página pública da «ya no está disponible» (410) y no muestra a nadie", async () => {
    const r = await kit.api("GET", `/shifts/${tomado.id}/public`);
    igual(r.status, 410, "turno tomado");
    const html = await (await fetch(`http://localhost:3100/turno/${tomado.id}`)).text();
    afirmar(!/Wanda Privada/.test(html), "el HTML de un turno tomado nombra a la persona");
  });

  // ── Por pantalla ──
  const sc = await ctx.sesion({ name: "ens-f-comercio-ajeno", viewport: "mobile", theme: "light" });
  await ctx.paso("UI · El comercio ajeno abre Candidatos y el chat de un turno que no es suyo: no se ve ningún nombre ni mensaje ajeno", async () => {
    await kit.loginAs(sc.page, c2);
    for (const ruta of [`/shifts/${abierto.id}/candidates`, `/chats/${tomado.id}`]) {
      await sc.page.goto(ruta);
      await sc.page.waitForLoadState("networkidle").catch(() => {});
      await sc.page.waitForTimeout(1200);
      const t = await texto(sc.page);
      afirmar(!/Walter Ajeno|Wanda Privada|Mensaje privado/.test(t), `${ruta} muestra datos ajenos: ${t.slice(0, 200)}`);
    }
    await sc.shot("f-comercio-ajeno");
  });
  await ctx.paso("UI · La pantalla Candidatos de un turno ajeno dice que no existe (hoy muestra «Todavía nadie se postuló» aunque haya postulantes)", async () => {
    // Walter ya se postuló a este turno: el comercio ajeno no debería ver una pantalla de candidatos «vacía» como si fuera suya.
    await sc.page.goto(`/shifts/${abierto.id}/candidates`);
    await sc.page.waitForLoadState("networkidle").catch(() => {});
    await sc.page.waitForTimeout(1200);
    const t = await texto(sc.page);
    afirmar(!/Todavía nadie se postuló/.test(t), `la pantalla finge que el turno ajeno no tiene postulantes: «${t.slice(0, 220)}»`);
  });
  await ctx.pantallaLimpia(sc, "turnos ajenos", [/\b404\b/, /WebSocket connection/]);
  const sw = await ctx.sesion({ name: "ens-f-persona-ajena", viewport: "mobile", theme: "light" });
  await ctx.paso("UI · La persona ajena abre el chat de otra y no ve mensajes ni nombres", async () => {
    await kit.loginAs(sw.page, w2);
    await sw.page.goto(`/chats/${tomado.id}`);
    await sw.page.waitForLoadState("networkidle").catch(() => {});
    await sw.page.waitForTimeout(1200);
    const t = await texto(sw.page);
    afirmar(!/Mensaje privado|Dueño Uno/.test(t), `muestra el chat ajeno: ${t.slice(0, 200)}`);
    await sw.shot("f-persona-ajena-chat");
  });
  await ctx.pantallaLimpia(sw, "chat ajeno", [/\b404\b/, /WebSocket connection/]);
  await ctx.paso("UI · Una persona que no es admin entra a /admin y no ve la administración", async () => {
    await sw.page.goto("/admin");
    await sw.page.waitForLoadState("networkidle").catch(() => {});
    await sw.page.waitForTimeout(1200);
    const t = await texto(sw.page);
    afirmar(!/Turnos en vivo|Verificación|Personas|Métricas/.test(t) || /no tenés|permiso|no autorizado/i.test(t), `se ve el menú de administración: ${t.slice(0, 200)}`);
    await sw.shot("f-no-admin");
  });
  await ctx.pantallaLimpia(sw, "/admin sin ser admin", [/\b40[13]\b/]);
}
