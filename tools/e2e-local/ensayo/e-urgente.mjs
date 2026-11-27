// E. Urgente: marca desde la publicación, escalada a los 8 minutos, aviso a cercanos y «no cubierto».
import { kit, afirmar, igual, estado, contiene, turno, postular, esperar, avisos, texto, cuenta, tokenAdmin, verificarPorApi, leerTurno, despertarScheduler } from "./lib.mjs";

export const letra = "E";
export const titulo = "Urgente y no cubierto";

const avisosDelTurno = (tipo, id) => Number(kit.db(`select count(*)::int as n from notifications where type = '${tipo}' and link = '/turno/${id}'`)[0].n);

export async function correr(ctx) {
  const marca = Math.random().toString(36).slice(2, 6);
  const nombre = `Bar Urgente ${marca}`;
  const com = await cuenta("employer", "e-bar", { fullName: "Dueño Ensayo E", profile: { name: nombre } });
  const w = await cuenta("worker", "e-mozo", { fullName: "Eva Cercana" });

  // ── Urgente desde la publicación ──
  let tu;
  await ctx.paso("Un turno marcado «urgente» al publicar sale con el aviso «¡Urgente! Turno … cerca tuyo» a personas cercanas", async () => {
    tu = await turno(com, { inicioH: 1.5, urgent: true });
    afirmar((await leerTurno(com.token, tu.id)).urgent === true, "el turno no quedó urgente");
    const n = await esperar(async () => avisosDelTurno("new_shift_nearby", tu.id) || null, "avisos de turno cercano", 15000);
    afirmar(n >= 1 && n <= 10, `esperaba entre 1 y 10 avisos y hay ${n}`);
    const titulos = kit.db(`select distinct title from notifications where type = 'new_shift_nearby' and link = '/turno/${tu.id}'`).map((r) => r.title);
    afirmar(titulos.every((t) => /Urgente/.test(t)), `el aviso de un turno urgente no dice «Urgente»: ${JSON.stringify(titulos)}`);
  }, { critico: true });

  const sw = await ctx.sesion({ name: "ens-e-persona", viewport: "mobile", theme: "light", geo: { lat: -34.5775, lng: -58.4256 } });
  await ctx.paso("UI · En el Inicio de la persona el turno urgente aparece en «Urgentes» con su cuenta regresiva «Empieza en…»", async () => {
    await kit.loginAs(sw.page, w);
    await sw.page.goto("/feed");
    await sw.page.waitForLoadState("networkidle").catch(() => {});
    const tarjeta = sw.page.getByText(nombre).first();
    await tarjeta.waitFor({ timeout: 20000 });
    const t = await texto(sw.page);
    contiene(t, /Urgente/, "no hay marca de urgente");
    contiene(t, /Empieza en/, "no hay cuenta regresiva");
    await sw.shot("e-inicio-urgente");
  });
  await ctx.pantallaLimpia(sw, "Inicio con un turno urgente");

  // ── Escalada a los 8 minutos ──
  const t7 = await turno(com, { inicioH: 5, position: "bartender" });
  const t9 = await turno(com, { inicioH: 5, position: "barista" });
  await ctx.paso("Reloj adelantado (db(), turnos propios): uno se publicó hace 7 min y otro hace 9 min; se despierta al scheduler", async () => {
    kit.db(`update shifts set published_at = now() - interval '7 minutes' where id = '${t7.id}'`);
    kit.db(`update shifts set published_at = now() - interval '9 minutes' where id = '${t9.id}'`);
    await despertarScheduler(com);
  });
  await ctx.paso("A los 9 minutos el turno sube a urgente solo y avisa a un círculo más amplio («urgent_shift_nearby»)", async () => {
    await esperar(async () => (await leerTurno(com.token, t9.id)).urgent === true, "escalada del turno de 9 min", 100000);
    const t = await leerTurno(com.token, t9.id);
    afirmar(t.status === "publicado" || t.status === "buscando_personal", `estado ${t.status}`);
    const n = await esperar(async () => avisosDelTurno("urgent_shift_nearby", t9.id) || null, "avisos urgentes", 15000);
    afirmar(n >= 1 && n <= 20, `esperaba entre 1 y 20 avisos de la escalada y hay ${n}`);
    const titulos = kit.db(`select distinct title from notifications where type = 'urgent_shift_nearby' and link = '/turno/${t9.id}'`).map((r) => r.title);
    afirmar(titulos.every((x) => /Urgente/.test(x)), `títulos ${JSON.stringify(titulos)}`);
  });
  await ctx.paso("A los 7 minutos todavía NO escaló: sigue sin ser urgente y no hay avisos urgentes", async () => {
    const t = await leerTurno(com.token, t7.id);
    igual(t.urgent, false, "el turno de 7 min");
    igual(avisosDelTurno("urgent_shift_nearby", t7.id), 0, "avisos urgentes del turno de 7 min");
  });
  await ctx.paso("El turno escalado aparece como urgente en el feed de las personas", async () => {
    let hallado = null;
    for (let off = 0; off < 300 && !hallado; off += 50) {
      const f = estado(await kit.api("GET", `/shifts/feed?scope=all&limit=50&offset=${off}&position=barista`, { token: w.token }), 200, "feed");
      hallado = f.find((s) => s.id === t9.id);
      if (f.length < 50) break;
    }
    afirmar(hallado, "el turno escalado no aparece en el feed de «barista»");
    igual(hallado.urgent, true, "marca urgente en el feed");
  });
  await ctx.paso("Una escalada no se repite: el turno no vuelve a avisar en la pasada siguiente", async () => {
    const antes = avisosDelTurno("urgent_shift_nearby", t9.id);
    await despertarScheduler(com);
    await kit.sleep(35000);
    igual(avisosDelTurno("urgent_shift_nearby", t9.id), antes, "avisos urgentes tras otra pasada del scheduler");
  });

  // ── No cubierto ──
  const tuU = await turno(com, { inicioH: 3, urgent: true, position: "cajero" });
  const tuN = await turno(com, { inicioH: 3, position: "recepcionista" });
  const tuAun = await turno(com, { inicioH: 3, position: "runner" });
  await ctx.paso("Reloj adelantado: el urgente empezó hace 31 min, el normal hace 2 h 5 min y otro normal hace 1 h; nadie fue elegido", async () => {
    const mover = (id, min) => kit.db(`update shifts set start_at = now() - interval '${min} minutes', end_at = now() - interval '${min} minutes' + interval '5 hours', published_at = now() - interval '1 day', escalated_at = now() - interval '1 day' where id = '${id}'`);
    mover(tuU.id, 31);
    mover(tuN.id, 125);
    mover(tuAun.id, 60);
    await despertarScheduler(com);
  });
  await ctx.paso("El turno urgente sin cubrir pasa a «no cubierto» a los 30 minutos y el comercio recibe el aviso", async () => {
    await esperar(async () => (await leerTurno(com.token, tuU.id)).status === "no_cubierto", "no cubierto del urgente", 100000);
    afirmar((await avisos(com, "shift_not_covered")).length >= 1, "el comercio no recibió el aviso de no cubierto");
  });
  await ctx.paso("El turno normal sin cubrir pasa a «no cubierto» recién a las 2 horas", async () => {
    await esperar(async () => (await leerTurno(com.token, tuN.id)).status === "no_cubierto", "no cubierto del normal", 100000);
  });
  await ctx.paso("El turno normal que empezó hace 1 hora todavía NO está «no cubierto» (la gracia es de 2 h) y ya no se ofrece en el feed", async () => {
    const t = await leerTurno(com.token, tuAun.id);
    afirmar(["publicado", "buscando_personal"].includes(t.status), `estado ${t.status}`);
    const f = estado(await kit.api("GET", `/shifts/feed?scope=all&limit=50&position=runner`, { token: w.token }), 200, "feed");
    afirmar(!f.some((s) => s.id === tuAun.id), "el feed ofrece un turno cuyo horario ya pasó");
  });
  await ctx.paso("«No cubierto» no castiga: el comercio no suma cancelaciones tardías y nadie suma ausencias", async () => {
    const f = kit.db(`select late_cancellations from company_profiles where id = '${com.profile.id}'`)[0];
    igual(Number(f.late_cancellations), 0, "cancelaciones tardías del comercio");
    igual(Number(kit.db(`select no_shows from worker_profiles where id = '${w.profile.id}'`)[0].no_shows), 0, "ausencias de la persona");
  });
  const sc = await ctx.sesion({ name: "ens-e-comercio", viewport: "mobile", theme: "light" });
  await ctx.paso("UI · El panel del comercio muestra el turno como «No cubierto» en Terminados", async () => {
    await kit.loginAs(sc.page, com);
    await sc.page.goto("/shifts");
    await sc.page.waitForLoadState("networkidle").catch(() => {});
    await sc.page.waitForTimeout(1200);
    contiene(await texto(sc.page), /No cubierto/i, "el panel no menciona «No cubierto»");
    await sc.shot("e-panel-no-cubierto");
  });
  await ctx.pantallaLimpia(sc, "panel con turnos no cubiertos");
}
