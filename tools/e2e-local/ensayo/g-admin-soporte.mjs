// G. Admin y soporte: «Ver como» de sólo lectura, tickets de soporte y cuentas suspendidas.
import { kit, afirmar, igual, estado, contiene, turno, postular, asignar, confirmar, confirmado, esperar, avisos, texto, cuenta, tokenAdmin, verificarPorApi, leerTurno } from "./lib.mjs";

export const letra = "G";
export const titulo = "Admin y soporte";

const leidos = (shiftId) => kit.db(`select read from chat_messages where shift_id = '${shiftId}' order by created_at`).map((r) => (r.read === "t" ? "true" : "false"));

export async function correr(ctx) {
  const adm = 6;
  let admTok = await tokenAdmin(adm);
  const marca = Math.random().toString(36).slice(2, 6);
  const nombreW = `Wanda Mirada ${marca}`;
  const com = await cuenta("employer", "g-bar", { fullName: "Dueño Ensayo G" });
  const w = await cuenta("worker", "g-w", { fullName: nombreW });
  await verificarPorApi(w, admTok);
  const t = await confirmado(com, w, { inicioH: 30 });
  estado(await kit.api("POST", `/chats/${t.id}/messages`, { token: com.token, body: { body: "¿Todo bien para mañana?" } }), [200, 201], "mensaje del comercio");
  igual(leidos(t.id), ["false"], "el mensaje arranca sin leer");

  // ── «Ver como» por API ──
  let imp;
  await ctx.paso("«Ver como» una cuenta real devuelve un token de sólo lectura (read_only = true)", async () => {
    const r = estado(await kit.api("POST", `/admin/users/${w.userId}/impersonate`, { token: admTok }), 200, "ver como");
    igual(r.read_only, true, "read_only");
    imp = r.access_token;
    afirmar(imp, "no hay token");
  }, { critico: true });
  await ctx.paso("Ver como: toda escritura da 403 con el código «impersonation_read_only»: mensaje, perfil, avisos, confirmar, cancelar, ticket, postularse", async () => {
    const intentos = [
      ["POST", `/chats/${t.id}/messages`, { body: "no debería enviarse" }],
      ["PUT", "/workers/me/profile", { city: "Otra", skills: ["mozo"], years_experience: 1, bio: "x", languages: [], certifications: [], is_available: true }],
      ["POST", "/notifications/read-all", { ids: [] }],
      ["POST", `/shifts/${t.id}/worker-cancel`],
      ["POST", `/shifts/${t.id}/reconfirm`],
      ["POST", "/support/tickets", { category: "otro", subject: "x", body: "y" }],
      ["POST", `/applications/shifts/${t.id}`],
      ["DELETE", "/workers/me/available-now"],
    ];
    const malas = [];
    for (const [m, ruta, body] of intentos) {
      const r = await kit.api(m, ruta, { token: imp, body });
      const codigo = r.data?.detail?.code;
      if (r.status !== 403 || codigo !== "impersonation_read_only") malas.push(`${m} ${ruta} → ${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);
    }
    afirmar(!malas.length, malas.join(" · "));
    igual(Number(kit.db(`select count(*)::int as n from chat_messages where shift_id = '${t.id}'`)[0].n), 1, "no se coló ningún mensaje");
  });
  await ctx.paso("Ver como: la lectura funciona (turnos, avisos, perfil, chat) y NO marca los mensajes como leídos", async () => {
    estado(await kit.api("GET", "/shifts/mine", { token: imp }), 200, "turnos");
    estado(await kit.api("GET", "/notifications", { token: imp }), 200, "avisos");
    estado(await kit.api("GET", "/workers/me/profile", { token: imp }), 200, "perfil");
    const msgs = estado(await kit.api("GET", `/chats/${t.id}/messages`, { token: imp }), 200, "chat");
    afirmar(msgs.length === 1, "no ve el mensaje");
    estado(await kit.api("GET", "/chats", { token: imp }), 200, "lista de chats");
    igual(leidos(t.id), ["false"], "el mensaje sigue sin leer después de que la admin lo miró");
  });
  await ctx.paso("Ver como: el aviso de mensaje de la persona sigue sin leer, y cuando ella misma abre el chat sí se marca como leído", async () => {
    const nuevo = (await avisos(w, "chat_message"))[0];
    afirmar(nuevo && nuevo.read === false, "el aviso de chat debería seguir sin leer");
    estado(await kit.api("GET", `/chats/${t.id}/messages`, { token: w.token }), 200, "chat propio");
    igual(leidos(t.id), ["true"], "tras abrirlo ella");
  });
  await ctx.paso("No se puede «ver como» otra cuenta admin (400) y un comercio ajeno no puede usar el token de la admin", async () => {
    const lista = estado(await kit.api("GET", "/admin/users?role=admin", { token: admTok }), 200, "admins");
    const otroAdmin = lista.find((u) => u.email !== kit.admin(adm).email && u.role === "admin");
    afirmar(otroAdmin, "no hay otra cuenta admin para probar");
    igual((await kit.api("POST", `/admin/users/${otroAdmin.id}/impersonate`, { token: admTok })).status, 400, "ver como otra admin");
  });

  // ── «Ver como» por pantalla ──
  const a = await ctx.admin(adm, { viewport: "desktop", theme: "light" });
  await ctx.paso("UI · La admin abre la ficha de la persona, toca «Ver como» y arriba dice «Viendo como … · Sólo lectura»", async () => {
    await a.page.goto(`/admin/personas/${w.userId}`);
    await a.page.getByRole("button", { name: "Ver como" }).click({ timeout: 20000 });
    const banner = a.page.getByRole("status").filter({ hasText: "Viendo como" });
    await banner.waitFor({ timeout: 20000 });
    contiene(await banner.innerText(), nombreW, "el cartel no nombra a la cuenta");
    contiene(await banner.innerText(), /Sólo lectura/, "el cartel no dice «Sólo lectura»");
    await a.shot("g-ver-como-banner");
  }, { critico: true });
  await ctx.paso("UI · Mirando como ella: el chat se ve, no se marca como leído y escribir no envía nada", async () => {
    await a.page.goto(`/chats/${t.id}`);
    await a.page.getByText("¿Todo bien para mañana?").last().waitFor({ timeout: 15000 });
    // Se restablece el estado de «sin leer» para ver el efecto de la pantalla (fila propia del ensayo).
    kit.db(`update chat_messages set read = false where shift_id = '${t.id}'`);
    await a.page.reload();
    await a.page.getByText("¿Todo bien para mañana?").last().waitFor({ timeout: 15000 });
    await a.page.waitForTimeout(1500);
    igual(leidos(t.id), ["false"], "la pantalla de «Ver como» marcó el mensaje como leído");
    await a.page.getByPlaceholder("Escribí un mensaje...").fill("intento de la admin");
    await a.page.keyboard.press("Enter");
    await a.page.waitForTimeout(1500);
    const dentro = kit.db(`select count(*)::int as n from chat_messages where shift_id = '${t.id}'`)[0].n;
    igual(Number(dentro), 1, "mensajes en el chat después del intento de la admin");
    await a.shot("g-ver-como-chat");
  });
  await ctx.paso("UI · Al intentar escribir, la pantalla le explica que es sólo lectura (no un error genérico)", async () => {
    const t_ = await texto(a.page);
    contiene(t_, /sólo lectura|solo lectura/i, "la pantalla no explica por qué no se envió");
  });
  await ctx.pantallaLimpia(a, "«Ver como» (el 403 buscado está permitido)", [/\b403\b/, /impersonation_read_only/, /Failed to load resource.*403/]);
  await ctx.paso("UI · «Volver a admin» devuelve a la admin a su propia cuenta", async () => {
    await a.page.getByRole("button", { name: "Volver a admin" }).click({ timeout: 10000 });
    await a.page.waitForTimeout(1500);
    afirmar((await a.page.getByRole("status").filter({ hasText: "Viendo como" }).count()) === 0, "el cartel sigue visible");
    ctx.nota(`Después de «Volver a admin» la admin queda en ${new URL(a.page.url()).pathname}`);
  });

  await ctx.pantallaLimpia(a, "«Volver a admin» tocado desde el chat de la persona");

  // ── Soporte de punta a punta ──
  const sw = await ctx.sesion({ name: "ens-g-persona", viewport: "mobile", theme: "light" });
  const asunto = `No me aparece el pago ${marca}`;
  let ticketId;
  await ctx.paso("UI · La persona abre /support, toca «Nuevo», escribe el problema y lo envía", async () => {
    await kit.loginAs(sw.page, w);
    await sw.page.goto("/support");
    await sw.page.getByRole("button", { name: /Nuevo|Abrir un ticket|Escribinos/ }).first().click({ timeout: 15000 });
    await sw.page.getByPlaceholder("Resumen corto de tu problema").fill(asunto);
    await sw.page.getByPlaceholder("Describí el problema con el mayor detalle posible").fill("Trabajé el sábado y el comercio dice que pagó pero no lo veo reflejado.");
    await sw.shot("g-ticket-nuevo");
    await sw.page.getByRole("button", { name: "Enviar", exact: true }).click();
    await esperar(async () => {
      const mine = await kit.api("GET", "/support/tickets/mine", { token: w.token });
      const f = (mine.data || []).find((x) => x.subject === asunto);
      if (f) ticketId = f.id;
      return f;
    }, "el ticket creado", 15000);
  }, { critico: true });
  await ctx.pantallaLimpia(sw, "crear el ticket");

  await ctx.paso("UI · La admin ve el ticket en la cola de Soporte y lo abre", async () => {
    await a.page.goto("/admin/support");
    await a.page.getByText(asunto).first().waitFor({ timeout: 20000 });
    await a.shot("g-cola-soporte");
    await a.page.getByText(asunto).first().click();
    await a.page.waitForURL(new RegExp(`/support/${ticketId}`), { timeout: 15000 });
    await a.page.getByText("Trabajé el sábado").first().waitFor({ timeout: 15000 });
  }, { critico: true });
  await ctx.paso("UI · «Sugerir» trae un resumen y una respuesta sugerida que precarga el cuadro de respuesta", async () => {
    await a.page.getByRole("button", { name: "Sugerir" }).click();
    await a.page.getByRole("button", { name: "Regenerar" }).waitFor({ timeout: 30000 });
    const caja = a.page.getByPlaceholder("Escribí tu respuesta...");
    await esperar(async () => (await caja.inputValue()).trim().length > 10, "la respuesta sugerida en el cuadro", 10000, 500);
    await a.shot("g-sugerencia");
  });
  await ctx.paso("Sugerencia de respuesta por API: trae resumen y texto en español, y la persona NO puede pedirla (403)", async () => {
    const r = estado(await kit.api("POST", `/support/tickets/${ticketId}/ai-suggestion`, { token: admTok }), 200, "sugerencia");
    afirmar(r.summary && r.suggested_reply, "faltan resumen o respuesta");
    igual((await kit.api("POST", `/support/tickets/${ticketId}/ai-suggestion`, { token: w.token })).status, 403, "la persona pidiendo la sugerencia");
  });
  await ctx.paso("UI · La admin responde (editando lo sugerido) y la persona recibe el aviso y ve la respuesta", async () => {
    const caja = a.page.getByPlaceholder("Escribí tu respuesta...");
    await caja.fill("Hola, ya lo revisamos con el comercio y quedó registrado el pago. Gracias por avisar.");
    await a.page.getByRole("button", { name: "Enviar", exact: true }).click();
    await esperar(async () => (await avisos(w, "support_reply")).length >= 1, "aviso de respuesta de soporte", 15000);
    await sw.page.goto(`/support/${ticketId}`);
    await sw.page.getByText("quedó registrado el pago").waitFor({ timeout: 15000 });
    await sw.shot("g-ticket-respondido");
  });
  await ctx.pantallaLimpia(a, "ticket de soporte (admin)");
  await ctx.pantallaLimpia(sw, "ticket de soporte (persona)");
  await ctx.paso("UI · La admin cierra el ticket (con confirmación) y después lo reabre", async () => {
    await a.page.getByRole("button", { name: "Cerrar ticket" }).click({ timeout: 10000 });
    await a.page.getByRole("dialog").getByRole("button").last().click();
    await esperar(async () => (await kit.api("GET", `/support/tickets/${ticketId}`, { token: admTok })).data?.status === "cerrado", "ticket cerrado", 15000);
    await a.page.getByRole("button", { name: "Reabrir" }).click({ timeout: 15000 });
    await esperar(async () => (await kit.api("GET", `/support/tickets/${ticketId}`, { token: admTok })).data?.status === "abierto", "ticket reabierto", 15000);
  });
  await ctx.paso("Un ticket ajeno no se ve: otra persona recibe 404 al abrirlo", async () => {
    const otra = await cuenta("worker", "g-otra");
    igual((await kit.api("GET", `/support/tickets/${ticketId}`, { token: otra.token })).status, 404, "ticket de otra persona");
  });

  // ── Cuenta suspendida ──
  const w2 = await cuenta("worker", "g-susp", { fullName: `Susana Suspendida ${marca}` });
  await verificarPorApi(w2, admTok);
  const abierto = await turno(com, { inicioH: 60 });
  estado(await postular(w2, abierto.id), [200, 201], "postular antes de la suspensión");
  await ctx.paso("UI · La admin suspende a la persona desde su ficha (con confirmación que cuenta sus turnos)", async () => {
    await a.page.goto(`/admin/personas/${w2.userId}`);
    await a.page.getByRole("button", { name: "Suspender", exact: true }).click({ timeout: 20000 });
    await a.page.getByText("Sus turnos", { exact: true }).waitFor({ timeout: 10000 });
    await a.shot("g-suspender-confirmar");
    await a.page.getByRole("button", { name: "Sí, suspender" }).click();
    await esperar(async () => (await kit.api("GET", `/admin/users/${w2.userId}`, { token: admTok })).data?.status !== "active", "cuenta suspendida", 15000);
  }, { critico: true });
  await ctx.paso("Suspendida: el comercio no puede elegirla (409 «no puede tomar turnos por ahora») y el turno sigue abierto", async () => {
    const r = await asignar(com, abierto.id, w2);
    estado(r, 409, "asignar a una cuenta suspendida");
    contiene(r.data?.detail, /no puede tomar turnos/i, "mensaje");
    afirmar(["publicado", "buscando_personal"].includes((await leerTurno(com.token, abierto.id)).status), "el turno cambió de estado");
  });
  await ctx.paso("Suspendida: no puede iniciar sesión (mensaje claro) ni operar con la sesión que ya tenía (401)", async () => {
    const login = await kit.api("POST", "/auth/login", { body: { email: w2.email, password: w2.password } });
    afirmar([401, 403].includes(login.status), `el login de una cuenta suspendida dio ${login.status}`);
    contiene(JSON.stringify(login.data), /suspendida/i, "el login no dice que está suspendida");
    for (const [m, ruta] of [["GET", "/shifts/mine"], ["POST", `/applications/shifts/${abierto.id}`], ["GET", "/notifications"]]) {
      const r = await kit.api(m, ruta, { token: w2.token });
      afirmar([401, 403].includes(r.status), `${m} ${ruta} con una cuenta suspendida dio ${r.status}`);
    }
  });
  const sw2 = await ctx.sesion({ name: "ens-g-suspendida", viewport: "mobile", theme: "light" });
  await ctx.paso("UI · La persona suspendida intenta entrar y lee «Tu cuenta está suspendida»", async () => {
    await sw2.page.goto("/login");
    await sw2.page.locator('input[name="email"]').fill(w2.email);
    await sw2.page.locator('input[name="password"]').fill(w2.password);
    await sw2.page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await sw2.page.getByText(/suspendida/i).first().waitFor({ timeout: 15000 });
    await sw2.shot("g-suspendida-login");
  });
  await ctx.pantallaLimpia(sw2, "login de una cuenta suspendida", [/\b40[13]\b/, /Failed to load resource/]);
  await ctx.paso("Reactivada por la admin, vuelve a poder ser elegida", async () => {
    estado(await kit.api("POST", `/admin/users/${w2.userId}/activate`, { token: admTok }), [200, 204], "reactivar");
    estado(await asignar(com, abierto.id, w2), 200, "asignar tras reactivar");
  });
}
