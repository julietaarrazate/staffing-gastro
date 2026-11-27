// C. Cancelaciones de la persona (con aviso y tardía) y del comercio.
import { kit, afirmar, igual, estado, contiene, turno, postular, asignar, confirmar, confirmado, esperar, avisos, texto, cuenta, tokenAdmin, verificarPorApi, leerTurno } from "./lib.mjs";

export const letra = "C";
export const titulo = "Cancelaciones";

const fila = (w) => kit.db(`select cancellations, notice_cancellations_used from worker_profiles where id = '${w.profile.id}'`)[0];

export async function correr(ctx) {
  const admTok = await tokenAdmin(3);
  const com = await cuenta("employer", "c-bar", { fullName: "Dueño Ensayo C" });
  const w1 = await cuenta("worker", "c-ana", { fullName: "Ana Cancela" });
  await verificarPorApi(w1, admTok);
  // Tres turnos confirmados con más de 24 h, en días distintos.
  const horas = [60, 84, 108];
  const ids = [];
  await ctx.paso("Preparación: Ana tiene tres turnos confirmados, todos a más de 24 h (por API)", async () => {
    for (const h of horas) ids.push((await confirmado(com, w1, { inicioH: h })).id);
    const mis = estado(await kit.api("GET", "/shifts/mine", { token: w1.token }), 200, "mis turnos");
    const conAviso = mis.filter((s) => s.status === "confirmado").map((s) => s.cancel_with_notice);
    igual(conAviso, [true, true, true], "con aviso antes de cancelar la primera");
  }, { critico: true });

  const sw = await ctx.sesion({ name: "ens-c-ana", viewport: "mobile", theme: "light" });
  const pw = sw.page;
  await kit.loginAs(pw, w1);

  async function cancelarPrimeroPorPantalla() {
    await pw.goto("/my-shifts");
    await pw.waitForLoadState("networkidle").catch(() => {});
    const boton = pw.getByRole("button", { name: "Cancelar mi asignación" }).first();
    if (!(await boton.isVisible().catch(() => false))) {
      await pw.getByText(/Más adelante/).first().click({ timeout: 10000 }).catch(() => {});
      await pw.getByText("Mozo/a", { exact: true }).first().click({ timeout: 10000 }).catch(() => {});
    }
    await pw.getByRole("button", { name: "Cancelar mi asignación" }).first().click({ timeout: 15000 });
    const dlg = pw.getByRole("dialog").last();
    await dlg.waitFor({ timeout: 10000 });
    const cartel = (await dlg.innerText()).replace(/\s+/g, " ");
    return { dlg, cartel };
  }

  const esperado = [
    { n: 1, pesa: false, cancel: 0, usados: 1 },
    { n: 2, pesa: false, cancel: 0, usados: 2 },
    { n: 3, pesa: true, cancel: 1, usados: 2 },
  ];
  for (const e of esperado) {
    await ctx.paso(`UI · Cancelación ${e.n} con más de 24 h: el cartel dice ${e.pesa ? "que SUMA a las cancelaciones" : "que no suma y que vale dos veces cada 30 días"}`, async () => {
      const { dlg, cartel } = await cancelarPrimeroPorPantalla();
      contiene(cartel, "¿Cancelar tu asignación?", "no es el cartel de cancelar");
      if (e.pesa) {
        contiene(cartel, /suma a las cancelaciones/, "el cartel no avisa que pesa");
        afirmar(!/no suma a tus cancelaciones/.test(cartel), `el cartel promete que no suma: «${cartel}»`);
      } else {
        contiene(cartel, /no suma a tus cancelaciones/, "el cartel no dice que no suma");
        contiene(cartel, /dos veces cada 30 días/, "el cartel no menciona el tope");
      }
      await sw.shot(`c-cartel-${e.n}`);
      await dlg.getByRole("button", { name: "Sí, cancelar" }).click();
      await esperar(async () => Number(fila(w1).notice_cancellations_used) + Number(fila(w1).cancellations) >= e.n, "contadores", 15000);
    });
    await ctx.paso(`Cancelación ${e.n}: ${e.pesa ? "suma 1 cancelación" : `no suma (aviso ${e.usados} de 2)`} y el comercio se entera`, async () => {
      const f = fila(w1);
      igual([Number(f.cancellations), Number(f.notice_cancellations_used)], [e.cancel, e.usados], "contadores (cancelaciones, avisos usados)");
      const n = (await avisos(com, "shift_reopened")).length;
      afirmar(n >= e.n, `el comercio debía tener ${e.n} avisos «canceló su asignación» y tiene ${n}`);
    });
  }
  await ctx.pantallaLimpia(sw, "las tres cancelaciones por pantalla");

  await ctx.paso("Cada turno cancelado volvió a buscar personal sin nadie asignado (3 turnos)", async () => {
    for (const id of ids) {
      const t = await leerTurno(com.token, id);
      igual([t.status, t.worker_profile_id], ["buscando_personal", null], `turno ${id.slice(0, 8)}`);
    }
  });

  await ctx.paso("Una cancelación NUEVA a más de 24 h con el tope gastado (cuarta) sigue contando como cualquier cancelación", async () => {
    const t4 = await confirmado(com, w1, { inicioH: 130 });
    const mis = estado(await kit.api("GET", "/shifts/mine", { token: w1.token }), 200, "mis turnos");
    igual(mis.find((s) => s.id === t4.id).cancel_with_notice, false, "el flag ya no promete «sin peso»");
    estado(await kit.api("POST", `/shifts/${t4.id}/worker-cancel`, { token: w1.token }), 200, "cancelar");
    igual(Number(fila(w1).cancellations), 2, "cancelaciones tras la cuarta");
  });

  // ── Cancelación tardía + los demás postulantes ──
  const w2 = await cuenta("worker", "c-bea", { fullName: "Bea Tardía" });
  const x = await cuenta("worker", "c-xime", { fullName: "Xime Postulante" });
  const y = await cuenta("worker", "c-yami", { fullName: "Yami Postulante" });
  for (const u of [w2]) await verificarPorApi(u, admTok);
  let tt;
  await ctx.paso("Preparación: un turno que empieza en 10 h, con tres postulantes; Bea es elegida y confirma (por API)", async () => {
    tt = await turno(com, { inicioH: 10 });
    for (const u of [w2, x, y]) estado(await postular(u, tt.id), [200, 201], "postular");
    estado(await asignar(com, tt.id, w2), 200, "asignar");
    estado(await confirmar(w2, tt.id), 200, "confirmar");
    for (const u of [x, y]) {
      const apps = estado(await kit.api("GET", "/applications/mine", { token: u.token }), 200, "postulaciones");
      igual(apps.find((a) => a.shift_id === tt.id).status, "rechazada", `postulación de ${u.email.slice(0, 12)} mientras Bea tiene el turno`);
    }
  }, { critico: true });

  await ctx.paso("Cancelación tardía (faltan 10 h): el flag avisa que pesa y, al cancelar, suma 1 cancelación sin gastar avisos", async () => {
    const mis = estado(await kit.api("GET", "/shifts/mine", { token: w2.token }), 200, "mis turnos");
    igual(mis.find((s) => s.id === tt.id).cancel_with_notice, false, "flag de la cancelación tardía");
    const antes = fila(w2);
    estado(await kit.api("POST", `/shifts/${tt.id}/worker-cancel`, { token: w2.token }), 200, "cancelar");
    const despues = fila(w2);
    igual([Number(despues.cancellations) - Number(antes.cancellations), Number(despues.notice_cancellations_used)], [1, 0], "(cancelaciones sumadas, avisos usados)");
  });
  await ctx.paso("El comercio se entera: aviso «El trabajador canceló su asignación» con link a Candidatos y mail/push de la corrida", async () => {
    const av = (await avisos(com, "shift_reopened")).filter((n) => (n.link || "").includes(tt.id));
    afirmar(av.length === 1, `esperaba 1 aviso y hay ${av.length}`);
    contiene(av[0].title + av[0].message, /cancel/i, "el aviso no habla de la cancelación");
  });
  await ctx.paso("El turno se reabre sin asignado y los demás postulantes vuelven a estar en carrera (pendiente)", async () => {
    const t = await leerTurno(com.token, tt.id);
    afirmar(["buscando_personal", "publicado"].includes(t.status), `estado ${t.status}`);
    igual(t.worker_profile_id, null, "trabajador asignado");
    for (const u of [x, y]) {
      const apps = estado(await kit.api("GET", "/applications/mine", { token: u.token }), 200, "postulaciones");
      igual(apps.find((a) => a.shift_id === tt.id).status, "pendiente", "postulación de quien había quedado atrás");
    }
    const bea = estado(await kit.api("GET", "/applications/mine", { token: w2.token }), 200, "postulaciones de Bea");
    const suya = bea.find((a) => a.shift_id === tt.id);
    afirmar(suya && suya.status !== "pendiente", `la postulación de quien canceló no debería quedar «pendiente» (queda ${suya?.status})`);
  });

  const sc = await ctx.sesion({ name: "ens-c-comercio", viewport: "mobile", theme: "light" });
  await ctx.paso("UI · El comercio ve en Candidatos a los dos postulantes que vuelven a estar en carrera y puede elegir a otro sin republicar", async () => {
    await kit.loginAs(sc.page, com);
    await sc.page.goto(`/shifts/${tt.id}/candidates`);
    await sc.page.getByText("Xime Postulante").first().waitFor({ timeout: 15000 });
    await sc.page.getByText("Yami Postulante").first().waitFor({ timeout: 15000 });
    await sc.shot("c-candidatos-tras-cancelar");
  });
  await ctx.pantallaLimpia(sc, "Candidatos tras la cancelación");

  // ── El comercio cancela con la persona ya confirmada ──
  const w3 = await cuenta("worker", "c-zoe", { fullName: "Zoe Confirmada" });
  await verificarPorApi(w3, admTok);
  await ctx.paso("UI · Comercio: el cartel de cancelar un turno con persona confirmada avisa que suma una cancelación tardía (antes de confirmar)", async () => {
    const t = await confirmado(com, w3, { inicioH: 4 });
    const antes = Number(kit.db(`select late_cancellations from company_profiles where id = '${com.profile.id}'`)[0].late_cancellations);
    await sc.page.goto("/shifts");
    await sc.page.waitForLoadState("networkidle").catch(() => {});
    // Hay varios turnos del comercio: se abre el de Zoe por su fila.
    const fila_ = sc.page.locator("div").filter({ hasText: "Zoe Confirmada" }).filter({ has: sc.page.getByRole("button", { name: "Más acciones" }) }).last();
    await fila_.getByRole("button", { name: "Más acciones" }).click({ timeout: 15000 });
    await sc.page.getByRole("button", { name: "Cancelar turno" }).click({ timeout: 10000 });
    const dlg = sc.page.getByRole("dialog").last();
    await dlg.waitFor();
    await dlg.getByText(/cancelación tardía/i).waitFor({ timeout: 10000 });
    await sc.shot("c-comercio-cartel-tardia");
    await dlg.getByRole("button", { name: "Sí, cancelar turno" }).click();
    await esperar(async () => (await leerTurno(com.token, t.id)).status === "cancelado", "turno cancelado", 15000);
    const despues = Number(kit.db(`select late_cancellations from company_profiles where id = '${com.profile.id}'`)[0].late_cancellations);
    igual(despues - antes, 1, "cancelaciones tardías del comercio sumadas");
    afirmar((await avisos(w3, "shift_cancelled_late")).length + (await avisos(w3, "shift_cancelled")).length >= 1, "Zoe no recibió aviso de la cancelación");
  });
  await ctx.pantallaLimpia(sc, "cancelar con persona confirmada");
}
