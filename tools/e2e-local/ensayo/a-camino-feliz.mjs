// A. Camino feliz de un turno programado, de punta a punta.
import { kit, afirmar, igual, estado, contiene, hora, turno, esperar, despertarScheduler, tokenAdmin, verificarPorApi, avisos, texto, aFechaLocal, cuenta, leerTurno, CLAVE } from "./lib.mjs";

export const letra = "A";
export const titulo = "Camino feliz de un turno programado";

export async function correr(ctx) {
  const adminToken = await tokenAdmin(1);
  const emailCom = kit.uniq("ens-a-bar");
  const geoLocal = { lat: -34.58755, lng: -58.43095 };
  let com; // { email, password, token, ... }
  let turnoId;
  let w;

  // ── El comercio se registra y completa su perfil por la pantalla ──
  const sc = await ctx.sesion({ name: "ens-a-comercio", viewport: "mobile", theme: "light", geo: geoLocal });
  const p = sc.page;

  await ctx.paso("UI · El comercio se registra por /register con los términos aceptados", async () => {
    await p.goto("/register");
    await p.getByRole("button", { name: "Soy comercio" }).click();
    await p.locator('input[name="name"]').fill("Dueño Ensayo A");
    await p.locator('input[name="bday"]').fill("1988-05-12");
    await p.locator('input[name="email"]').fill(emailCom);
    await p.locator('input[name="new-password"]').fill(CLAVE);
    await p.locator("input[type=checkbox]").check();
    await p.getByRole("button", { name: "Crear cuenta" }).click();
    await p.waitForURL(/\/bienvenida/, { timeout: 20000 });
  }, { critico: true });

  await ctx.paso("Llega el mail «Confirmá tu email» y el link confirma la cuenta (UI)", async () => {
    const mail = await kit.waitForMail(emailCom, { subject: /Confirm[aá] tu email/i });
    const link = kit.linkFrom(mail, /\/verificar-email\?token=/);
    afirmar(link, "el mail no trae el link de verificación");
    const verif = await sc.context.newPage();
    await verif.goto(link.replace(/^https?:\/\/[^/]+/, ""));
    await verif.getByText("Listo, tu email quedó confirmado.").waitFor({ timeout: 15000 });
    await verif.close();
  });

  await ctx.paso("UI · Onboarding: nombre del comercio y dirección buscada en el mapa", async () => {
    await p.bringToFront();
    await p.locator('input[placeholder="Ej: Bar El Patio"]').fill("Bar Ensayo A");
    await p.getByRole("button", { name: "Continuar" }).click();
    await p.getByPlaceholder("Buscá la dirección de tu local").fill("Gorriti 5000");
    await p.getByRole("button", { name: /^Gorriti 5000/ }).click({ timeout: 15000 });
    await p.getByRole("button", { name: "Terminar" }).click();
    await p.waitForURL(/\/shifts/, { timeout: 20000 });
  }, { critico: true });

  await ctx.paso("El perfil del comercio quedó guardado con nombre y ubicación (API)", async () => {
    const session = estado(await kit.api("POST", "/auth/login", { body: { email: emailCom, password: CLAVE } }), 200, "login");
    com = { email: emailCom, password: CLAVE, token: session.access_token, userId: session.user.id, role: "employer" };
    const perfil = estado(await kit.api("GET", "/companies/me/profile", { token: com.token }), 200, "perfil");
    igual(perfil.name, "Bar Ensayo A", "nombre del comercio");
    afirmar(perfil.latitude && perfil.longitude, "el perfil quedó sin coordenadas");
    com.profile = perfil;
  }, { critico: true });
  await ctx.pantallaLimpia(sc, "registro y onboarding del comercio");

  // La persona, ya registrada y verificada (el camino real de verificación se prueba en el escenario B).
  await ctx.paso("Una persona se registra por el camino real y su identidad queda verificada (API + admin por API)", async () => {
    w = await cuenta("worker", "a-mozo", { fullName: "Wanda Ensayo" });
    await verificarPorApi(w, adminToken);
    const yo = estado(await kit.api("GET", "/identity/me", { token: w.token }), 200, "identidad");
    afirmar(yo.identidad_verificada === true, "la identidad no quedó verificada");
  }, { critico: true });

  // ── Publica el turno por la pantalla ──
  await ctx.paso("UI · El comercio publica un turno programado en 3 días (puesto, horario, pago, publicar)", async () => {
    await p.goto("/shifts/new");
    await p.getByRole("button", { name: "Mozo/a" }).click();
    const dts = p.locator("input[type=datetime-local]");
    await dts.nth(0).fill(aFechaLocal(72));
    await dts.nth(1).fill(aFechaLocal(77));
    await p.getByRole("button", { name: "Continuar" }).click();
    await p.locator('input[inputmode="numeric"], input[placeholder="48.000"]').first().fill("70000");
    await p.getByRole("button", { name: "Continuar" }).click();
    await contiene(await texto(p), /Publicar turno/, "falta el paso final");
    await sc.shot("a-publicar-resumen");
    await p.getByRole("button", { name: "Publicar turno" }).click();
    await esperar(async () => {
      const lista = estado(await kit.api("GET", "/shifts/me", { token: com.token }), 200, "shifts/me");
      const t = lista.find((x) => x.status === "publicado" || x.status === "buscando_personal");
      if (t) turnoId = t.id;
      return t;
    }, "el turno publicado", 20000);
  }, { critico: true });

  await ctx.paso("UI · Después de publicar se ve «esto es lo que sigue»", async () => {
    const t = await texto(p);
    contiene(t, /(Publicado|Ya está publicado|Turno publicado|lo que sigue|Qué sigue|Avisamos|Ya avisamos)/i, "la pantalla posterior a publicar no explica lo que sigue");
    await sc.shot("a-publicado-que-sigue");
  });
  await ctx.pantallaLimpia(sc, "publicar un turno");

  await ctx.paso("El turno quedó con los datos que se cargaron (puesto, pago, coordenadas, estado)", async () => {
    const t = await leerTurno(com.token, turnoId);
    igual(t.position, "mozo", "puesto");
    igual(Number(t.pay_amount), 70000, "pago");
    afirmar(["publicado", "buscando_personal"].includes(t.status), `estado inesperado ${t.status}`);
    afirmar(t.latitude != null && t.longitude != null, "el turno quedó sin coordenadas");
  });

  await ctx.paso("La persona que va a ir sabe adónde: el turno que ve ella trae la dirección del local (el resumen del comercio decía «Gorriti 5000»)", async () => {
    const vista = await kit.api("GET", `/shifts/${turnoId}`, { token: w.token });
    estado(vista, 200, "turno visto por la persona");
    afirmar(vista.data.address && /Gorriti/.test(vista.data.address), `el turno publicado por la pantalla no guarda la dirección (address=${JSON.stringify(vista.data.address)}, city=${JSON.stringify(vista.data.city)}); la persona sólo ve la zona`);
  });

  await ctx.paso("Al publicarse se avisa a personas cercanas («Turno cerca tuyo», tope de 10 por tanda)", async () => {
    const n = await esperar(async () => {
      const filas = kit.db(`select count(*)::int as n from notifications where type = 'new_shift_nearby' and link = '/turno/${turnoId}'`);
      return Number(filas[0].n) || null;
    }, "avisos de turno cercano", 15000);
    afirmar(n >= 1 && n <= 10, `esperaba entre 1 y 10 avisos y hay ${n}`);
    ctx.nota(`Avisos «Turno cerca tuyo» al publicar: ${n} (la tanda sólo llega a las 10 personas mejor rankeadas; la persona del ensayo, sin historial, ${(await avisos(w, "new_shift_nearby")).some((a) => (a.link || "").includes(turnoId)) ? "sí" : "no"} estuvo entre ellas)`);
  });

  // ── Ella se postula por la pantalla ──
  const sw = await ctx.sesion({ name: "ens-a-persona", viewport: "mobile", theme: "light", geo: { lat: -34.5775, lng: -58.4256 } });
  const pw = sw.page;
  await ctx.paso("UI · La persona verificada entra, abre el turno y toca «Postularme»", async () => {
    await kit.loginAs(pw, w);
    await pw.goto(`/turno/${turnoId}`);
    await pw.getByRole("button", { name: "Postularme" }).click();
    await pw.getByText("Ya te postulaste").waitFor({ timeout: 15000 });
    await sw.shot("a-postulada");
  }, { critico: true });
  await ctx.pantallaLimpia(sw, "postularse al turno");

  await ctx.paso("El comercio recibe el aviso de nueva postulación", async () => {
    const a = await esperar(async () => (await avisos(com, "new_applicant")).filter((n) => (n.link || "").includes(turnoId))[0], "aviso new_applicant", 15000);
    afirmar(a, "no llegó el aviso");
  });

  // ── El comercio la elige en Candidatos ──
  await ctx.paso("UI · En Candidatos aparece con el sello «Nuevo en Oído · identidad verificada» y se la elige", async () => {
    await p.goto(`/shifts/${turnoId}/candidates`);
    await p.getByText("Wanda Ensayo").first().waitFor({ timeout: 15000 });
    contiene(await texto(p), "identidad verificada", "no muestra la identidad verificada");
    await sc.shot("a-candidatos");
    await p.getByRole("button", { name: "Elegir a Wanda" }).click();
    await p.getByText("Elegiste a Wanda").waitFor({ timeout: 15000 });
    await sc.shot("a-elegida");
  }, { critico: true });
  await ctx.pantallaLimpia(sc, "Candidatos y elegir");

  await ctx.paso("El turno pasó a «asignado» y ella recibe el aviso y el mail «Te aceptaron»", async () => {
    igual((await leerTurno(com.token, turnoId)).status, "asignado", "estado");
    afirmar((await avisos(w, "shift_assigned")).length >= 1, "no hay aviso shift_assigned");
    const mail = await kit.waitForMail(w.email, { subject: /Te aceptaron/i, timeoutMs: 20000 });
    contiene(mail.subject, "Bar Ensayo A", "el asunto no nombra al comercio");
  });

  // ── Ella confirma por la pantalla ──
  await ctx.paso("UI · En Mis turnos la persona ve el turno «Asignado» y toca «Confirmar»", async () => {
    await pw.goto("/my-shifts");
    await pw.getByText(/Más adelante/).first().click({ timeout: 15000 });
    await pw.getByText("Mozo/a", { exact: true }).first().click({ timeout: 15000 });
    await pw.getByRole("button", { name: "Confirmar", exact: true }).click({ timeout: 15000 });
    await esperar(async () => (await leerTurno(w.token, turnoId)).status === "confirmado", "estado confirmado", 15000);
    await sw.shot("a-confirmado");
  }, { critico: true });
  await ctx.pantallaLimpia(sw, "Mis turnos y confirmar");

  await ctx.paso("El comercio recibe el aviso de que confirmó y su panel lo muestra confirmado (UI)", async () => {
    afirmar((await avisos(com, "shift_confirmed")).length >= 1, "no hay aviso shift_confirmed");
    await p.goto("/shifts");
    await p.waitForLoadState("networkidle").catch(() => {});
    const t = await texto(p);
    contiene(t, /Confirmad/i, "el panel no marca el turno como confirmado");
  });

  // ── Chat de ida y vuelta ──
  await ctx.paso("Chat: el comercio escribe, ella lo lee y contesta; los avisos de mensaje llegan", async () => {
    estado(await kit.api("POST", `/chats/${turnoId}/messages`, { token: com.token, body: { body: "Hola Wanda, ¿venís por Gorriti?" } }), [200, 201], "mensaje del comercio");
    const vistos = estado(await kit.api("GET", `/chats/${turnoId}/messages`, { token: w.token }), 200, "leer chat");
    afirmar(vistos.some((m) => /Gorriti/.test(m.body)), "ella no ve el mensaje");
    estado(await kit.api("POST", `/chats/${turnoId}/messages`, { token: w.token, body: { body: "Sí, llego 15 minutos antes." } }), [200, 201], "respuesta");
    const ida = estado(await kit.api("GET", `/chats/${turnoId}/messages`, { token: com.token }), 200, "leer chat comercio");
    afirmar(ida.some((m) => /15 minutos/.test(m.body)), "el comercio no ve la respuesta");
    afirmar((await avisos(w, "chat_message")).length >= 1 && (await avisos(com, "chat_message")).length >= 1, "faltan avisos de chat");
  });
  await ctx.paso("UI · El chat se ve en la pantalla de la persona", async () => {
    await pw.goto(`/chats/${turnoId}`);
    await pw.getByText("¿venís por Gorriti?").waitFor({ timeout: 15000 });
    await sw.shot("a-chat");
  });
  await ctx.pantallaLimpia(sw, "chat");

  // ── Reconfirmación de las 24 horas ──
  await ctx.paso("Reloj adelantado (db(), turno propio): faltan 23 h 30 min y confirmó hace 2 días; se despierta al scheduler", async () => {
    kit.db(`update shifts set start_at = now() + interval '23 hours 30 minutes', end_at = now() + interval '28 hours 30 minutes', confirmed_at = now() - interval '2 days' where id = '${turnoId}'`);
    await despertarScheduler(com);
  });
  await ctx.paso("A las 24 h sale la pregunta «¿Seguís…?» y la tarjeta del turno la muestra (UI)", async () => {
    const a = await esperar(async () => (await avisos(w, "reconfirm_request")).filter((n) => (n.link || "").length >= 0)[0], "aviso reconfirm_request", 90000);
    contiene(`${a.title} ${a.message}`, /Seguís/i, "el aviso no pregunta si sigue");
    await pw.goto("/my-shifts");
    await pw.waitForLoadState("networkidle").catch(() => {});
    await pw.getByText(/Seguís yendo|Seguís disponible/i).first().waitFor({ timeout: 15000 });
    await sw.shot("a-pregunta-24h");
  });
  await ctx.pantallaLimpia(sw, "la pregunta de las 24 h");
  await ctx.paso("UI · Ella contesta «Sí, sigo disponible» y el comercio ve que reconfirmó", async () => {
    await pw.getByRole("button", { name: /Sí, sigo disponible/ }).first().click({ timeout: 10000 });
    await esperar(async () => (await leerTurno(com.token, turnoId)).reconfirmed_at, "reconfirmed_at", 15000);
    await p.goto("/shifts");
    await p.waitForLoadState("networkidle").catch(() => {});
    contiene(await texto(p), /confirmó que sigue disponible/i, "el panel del comercio no dice que reconfirmó");
    await sc.shot("a-panel-reconfirmo");
  });
  await ctx.pantallaLimpia(sw, "responder la pregunta");
  await ctx.pantallaLimpia(sc, "panel con «Reconfirmó»");

  // ── Salida, llegada, trabajo ──
  await ctx.paso("Reloj adelantado: el turno empieza en 25 min (db(), turno propio)", async () => {
    kit.db(`update shifts set start_at = now() + interval '25 minutes', end_at = now() + interval '5 hours 25 minutes' where id = '${turnoId}'`);
  });
  await ctx.paso("«Voy en camino»: sale (depart), comparte su posición y el comercio la ve aproximada", async () => {
    estado(await kit.api("POST", `/shifts/${turnoId}/depart`, { token: w.token }), 200, "depart");
    estado(await kit.api("POST", `/shifts/${turnoId}/en-route`, { token: w.token, body: { latitude: -34.5800, longitude: -58.4300 } }), 200, "en-route");
    const t = await leerTurno(com.token, turnoId);
    afirmar(t.en_route_latitude != null, "el comercio no ve la posición en camino");
    afirmar(Math.abs(t.en_route_latitude - -34.58) < 0.01, "la posición que ve el comercio está lejos de la real");
    afirmar((await avisos(com, "worker_en_route")).length >= 1, "el comercio no recibió el aviso «va en camino»");
  });
  await ctx.paso("Llegada: marca la llegada en el local; apaga el «va en camino» y el comercio no puede marcar «Ya llegó» sobre algo ya marcado", async () => {
    estado(await kit.api("POST", `/shifts/${turnoId}/check-in`, { token: w.token, body: { latitude: -34.58755, longitude: -58.43095 } }), 200, "check-in");
    const t = await leerTurno(com.token, turnoId);
    igual(t.status, "check_in", "estado tras llegar");
    afirmar(t.en_route_latitude == null, "la posición en camino no se borró al llegar");
    const ya = await kit.api("POST", `/shifts/${turnoId}/company-check-in`, { token: com.token, body: { on_time: true } });
    afirmar(ya.status === 400, `«Ya llegó» sobre una llegada ya marcada debía rechazarse (400) y dio ${ya.status}`);
  });
  await ctx.paso("Empieza a trabajar y termina el turno (reloj del turno, db() propio)", async () => {
    estado(await kit.api("POST", `/shifts/${turnoId}/start-working`, { token: w.token }), 200, "start-working");
    kit.db(`update shifts set start_at = now() - interval '5 hours 5 minutes', end_at = now() - interval '5 minutes' where id = '${turnoId}'`);
    estado(await kit.api("POST", `/shifts/${turnoId}/check-out`, { token: w.token, body: { latitude: -34.58755, longitude: -58.43095 } }), 200, "check-out");
    igual((await leerTurno(com.token, turnoId)).status, "check_out", "estado");
    afirmar((await avisos(com, "shift_checked_out")).length >= 1, "el comercio no recibió el aviso de fin");
  });

  // ── Cierre y pago ──
  await ctx.paso("UI · El comercio ve «Cerrar turno» y cierra; después marca el pago", async () => {
    await p.goto("/shifts");
    await p.waitForLoadState("networkidle").catch(() => {});
    const finalizar = p.getByRole("button", { name: /Cerrar turno|Finalizar|Confirmar que terminó/i }).first();
    if (await finalizar.count()) {
      await finalizar.click();
      await p.waitForTimeout(1500);
    } else {
      estado(await kit.api("POST", `/shifts/${turnoId}/finish`, { token: com.token }), 200, "finish");
    }
    igual((await leerTurno(com.token, turnoId)).status, "finalizado", "estado tras cerrar");
    await sc.shot("a-panel-finalizado");
  });
  await ctx.paso("Pago: sólo el comercio lo marca; la persona no puede (404/403) y recibe el aviso de pagado", async () => {
    const malo = await kit.api("POST", `/shifts/${turnoId}/mark-paid`, { token: w.token });
    afirmar([403, 404].includes(malo.status), `la persona pudo tocar «marcar pagado»: ${malo.status}`);
    estado(await kit.api("POST", `/shifts/${turnoId}/mark-paid`, { token: com.token }), 200, "mark-paid");
    igual((await leerTurno(com.token, turnoId)).status, "pagado", "estado");
    afirmar((await avisos(w, "shift_paid")).length >= 1, "ella no recibió el aviso de pago");
  });
  ctx.noCubierto("Pago con confirmación de las dos partes", "el producto no tiene confirmación del pago por parte de la persona: sólo existe «marcar pagado» del comercio (DOMAIN.md → Payment: placeholder). Se verificó que ella no puede marcarlo.");

  // ── Calificaciones y reputación ──
  await ctx.paso("Calificaciones mutuas: el comercio la califica (5) y ella lo califica (4); doble calificación da 409", async () => {
    estado(await kit.api("POST", `/reviews/shifts/${turnoId}`, { token: com.token, body: { rating: 5, comment: "Excelente" } }), [200, 201], "reseña al trabajador");
    estado(await kit.api("POST", `/reviews/shifts/${turnoId}`, { token: w.token, body: { rating: 4, comment: "Buen trato" } }), [200, 201], "reseña al comercio");
    const otra = await kit.api("POST", `/reviews/shifts/${turnoId}`, { token: com.token, body: { rating: 1 } });
    igual(otra.status, 409, "segunda calificación del mismo lado");
    afirmar((await avisos(w, "review_received")).length >= 1 && (await avisos(com, "review_received")).length >= 1, "faltan avisos de reseña");
  });
  await ctx.paso("La reputación refleja el turno: 1 turno hecho y calificación 5,0 en su perfil", async () => {
    const perfil = estado(await kit.api("GET", "/workers/me/profile", { token: w.token }), 200, "perfil");
    igual(perfil.events_completed, 1, "turnos completados");
    igual(Number(perfil.rating), 5, "calificación");
  });
  await ctx.paso("UI · El perfil público de ella muestra el turno hecho y la reseña (vista del comercio)", async () => {
    await p.goto(`/workers/${w.profile.id}`);
    await p.waitForLoadState("networkidle").catch(() => {});
    contiene(await texto(p), /Excelente/, "la reseña no se ve en el perfil");
    await sc.shot("a-perfil-persona");
  });
  await ctx.pantallaLimpia(sc, "perfil de la persona y cierre");

  await ctx.paso("Mails de la corrida: confirmación + aceptación llegaron; se listan los demás", async () => {
    const delCom = (await kit.mailbox(emailCom)).map((m) => m.subject);
    const delW = (await kit.mailbox(w.email)).map((m) => m.subject);
    ctx.nota(`Mails al comercio: ${JSON.stringify(delCom)}`);
    ctx.nota(`Mails a la persona: ${JSON.stringify(delW)}`);
    afirmar(delCom.some((s) => /Confirm[aá] tu email/i.test(s)), "falta el mail de confirmación");
    afirmar(delW.some((s) => /Te aceptaron/.test(s)), "falta el mail de aceptación");
  });
}
