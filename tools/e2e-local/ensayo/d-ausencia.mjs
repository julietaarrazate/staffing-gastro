// D. Ausencia: «No se presentó», no-show automático, «Ya llegó» y reemplazo.
import { kit, afirmar, igual, estado, contiene, turno, postular, asignar, confirmar, confirmado, esperar, avisos, texto, cuenta, tokenAdmin, verificarPorApi, leerTurno, despertarScheduler } from "./lib.mjs";

export const letra = "D";
export const titulo = "Ausencia y llegada";

const perfilDb = (w) => kit.db(`select no_shows, events_completed from worker_profiles where id = '${w.profile.id}'`)[0];
const moverInicio = (id, minutosDesdeInicio, durMin = 300) =>
  kit.db(`update shifts set start_at = now() - interval '${minutosDesdeInicio} minutes', end_at = now() - interval '${minutosDesdeInicio} minutes' + interval '${durMin} minutes', confirmed_at = now() - interval '2 days' where id = '${id}'`);

export async function correr(ctx) {
  const admTok = await tokenAdmin(4);
  const com = await cuenta("employer", "d-bar", { fullName: "Dueño Ensayo D" });
  const dana = await cuenta("worker", "d-dana", { fullName: "Dana Falta" });
  const eli = await cuenta("worker", "d-eli", { fullName: "Eli Silencio" });
  const fran = await cuenta("worker", "d-fran", { fullName: "Fran Tarde" });
  const gabi = await cuenta("worker", "d-gabi", { fullName: "Gabi Reemplazo" });
  for (const u of [dana, eli, fran, gabi]) await verificarPorApi(u, admTok);

  const sc = await ctx.sesion({ name: "ens-d-comercio", viewport: "mobile", theme: "light" });
  await kit.loginAs(sc.page, com);
  const p = sc.page;
  const filaDe = (nombre) => p.locator("div").filter({ hasText: nombre }).filter({ has: p.getByRole("button", { name: "Más acciones" }) }).last();

  // ── «No se presentó» sólo desde los 10 minutos ──
  const t1 = await confirmado(com, dana, { inicioH: 5 });
  const eliTurno = await confirmado(com, eli, { inicioH: 6 });

  await ctx.paso("Reloj adelantado (db(), turno propio): Dana debía llegar hace 3 min y no marcó", async () => {
    moverInicio(t1.id, 3);
  });
  await ctx.paso("A los 3 minutos «No se presentó» NO se ofrece en la pantalla del comercio y el servidor lo rechaza (400)", async () => {
    await p.goto("/shifts");
    await p.waitForLoadState("networkidle").catch(() => {});
    const fila = filaDe("Dana");
    await fila.getByRole("button", { name: "Más acciones" }).click({ timeout: 15000 });
    await p.getByRole("button", { name: "Cancelar turno" }).waitFor({ timeout: 10000 });
    afirmar((await p.getByRole("button", { name: "No se presentó" }).count()) === 0, "se ofrece «No se presentó» a los 3 minutos");
    await sc.shot("d-menu-3-min");
    await p.keyboard.press("Escape");
    const r = await kit.api("POST", `/shifts/${t1.id}/no-show`, { token: com.token });
    igual(r.status, 400, "No se presentó a los 3 minutos");
    contiene(JSON.stringify(r.data), /10 minutos/, "el mensaje no dice cuándo se puede");
  });
  await ctx.pantallaLimpia(sc, "menú de acciones a los 3 minutos", [/\b400\b/]);

  await ctx.paso("Reloj adelantado: Dana debía llegar hace 12 min", async () => {
    moverInicio(t1.id, 12);
  });
  await ctx.paso("UI · A los 12 minutos el comercio ve «No se presentó», lo confirma y el turno se reofrece", async () => {
    await p.goto("/shifts");
    await p.waitForLoadState("networkidle").catch(() => {});
    await filaDe("Dana").getByRole("button", { name: "Más acciones" }).click({ timeout: 15000 });
    await p.getByRole("button", { name: "No se presentó" }).click({ timeout: 10000 });
    await sc.shot("d-confirmar-no-show");
    await p.getByRole("button", { name: "Sí, no se presentó" }).click({ timeout: 10000 });
    await esperar(async () => (await leerTurno(com.token, t1.id)).worker_profile_id === null, "turno sin asignado", 15000);
  });
  await ctx.pantallaLimpia(sc, "«No se presentó»");

  await ctx.paso("Impacto: a Dana se le suma 1 ausencia, el turno se reofrece como urgente y el comercio recibe el aviso", async () => {
    igual(Number(perfilDb(dana).no_shows), 1, "ausencias de Dana");
    const t = await leerTurno(com.token, t1.id);
    afirmar(t.status === "buscando_personal" && t.urgent === true && t.reoffered_at, `el turno debía quedar reofrecido y urgente: status=${t.status} urgent=${t.urgent} reoffered_at=${t.reoffered_at}`);
    const av = (await avisos(com, "shift_reopened")).filter((n) => (n.link || "").includes(t1.id));
    afirmar(av.length === 1, `esperaba 1 aviso al comercio y hay ${av.length}`);
    afirmar((await avisos(dana, "shift_no_show")).length >= 1, "Dana no recibió el aviso de ausencia");
  });
  await ctx.paso("Dana no recibe puntos por un turno que no hizo (turnos completados sigue en 0)", async () => {
    igual(Number(perfilDb(dana).events_completed), 0, "turnos completados de Dana");
  });

  await ctx.paso("El comercio elige a otra persona sin volver a publicar: Gabi toma el turno reofrecido y confirma", async () => {
    estado(await postular(gabi, t1.id), [200, 201, 409], "postular Gabi");
    const lista = estado(await kit.api("GET", `/applications/shifts/${t1.id}`, { token: com.token }), 200, "postulantes");
    afirmar(lista.some((a) => a.worker_profile_id === gabi.profile.id), "Gabi no está entre los postulantes");
    estado(await asignar(com, t1.id, gabi), 200, "asignar a Gabi");
    const c = estado(await confirmar(gabi, t1.id), 200, "confirmar Gabi");
    igual(c.status, "confirmado", "estado");
    igual((await leerTurno(com.token, t1.id)).id, t1.id, "es el mismo turno, no uno nuevo");
  });

  // ── No-show automático a las 2 horas ──
  await ctx.paso("Reloj adelantado: Eli debía llegar hace 2 h 5 min; se despierta al scheduler", async () => {
    moverInicio(eliTurno.id, 125, 480);
    await despertarScheduler(com);
  });
  await ctx.paso("A las 2 h sin llegada el sistema marca la ausencia solo: Eli suma 1 ausencia y el comercio recibe el aviso", async () => {
    await esperar(async () => (await leerTurno(com.token, eliTurno.id)).worker_profile_id === null, "no-show automático", 100000);
    igual(Number(perfilDb(eli).no_shows), 1, "ausencias de Eli");
    const av = (await avisos(com, "shift_reopened")).filter((n) => (n.link || "").includes(eliTurno.id));
    afirmar(av.length === 1, `esperaba 1 aviso al comercio y hay ${av.length}`);
    contiene(av[0].title + av[0].message, /No registramos la llegada/, "el aviso automático no dice que no se registró la llegada");
    const t = await leerTurno(com.token, eliTurno.id);
    afirmar(t.status === "buscando_personal" || t.status === "no_cubierto", `estado ${t.status}`);
  });

  // ── «Ya llegó» ──
  const fTurno = await confirmado(com, fran, { inicioH: 7 });
  await ctx.paso("Reloj adelantado: Fran debía llegar hace 1 minuto y no marcó", async () => {
    moverInicio(fTurno.id, 1);
  });
  await ctx.paso("UI · El comercio ve «Ya llegó», contesta «Sí, llegó a horario» y Fran queda como llegada a horario", async () => {
    await p.goto("/shifts");
    await p.waitForLoadState("networkidle").catch(() => {});
    const fila = filaDe("Fran");
    await fila.getByRole("button", { name: "Ya llegó" }).click({ timeout: 15000 });
    await p.getByRole("button", { name: "Sí, llegó a horario" }).click({ timeout: 10000 });
    await esperar(async () => (await leerTurno(com.token, fTurno.id)).status === "check_in", "llegada marcada por el comercio", 15000);
    await sc.shot("d-ya-llego");
  });
  await ctx.paso("«Ya llegó» deja la llegada puntual y le avisa a Fran", async () => {
    const t = await leerTurno(com.token, fTurno.id);
    igual(t.arrival_on_time, true, "arrival_on_time");
    afirmar(t.arrival_marked_by_company_at, "falta la marca de quién registró la llegada");
    afirmar((await avisos(fran, "arrival_marked_by_company")).length >= 1, "Fran no recibió el aviso");
  });
  await ctx.pantallaLimpia(sc, "«Ya llegó»");
}
