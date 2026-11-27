// J. Recorrido visual: capturas en claro y oscuro de las pantallas principales de cada rol.
// Las capturas hay que MIRARLAS (el informe sólo dice dónde están): tsc y los tests no ven contraste.
import { kit, afirmar, igual, estado, contiene, turno, postular, asignar, confirmar, confirmado, cuenta, tokenAdmin, verificarPorApi, texto, hora, leerTurno } from "./lib.mjs";

export const letra = "J";
export const titulo = "Recorrido visual";

const MALAS = /Algo salió mal|Application error|Unhandled Runtime Error|This page could not be found|Internal Server Error|undefined|\[object Object\]|NaN/;

async function ponerTema(s, tema) {
  await s.page.evaluate((t) => localStorage.setItem("oido-theme", t), tema);
  await s.page.reload();
  await s.page.waitForLoadState("networkidle").catch(() => {});
  const real = await s.page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  if (real !== tema) throw new Error(`no se pudo poner el tema ${tema} (quedó ${real})`);
}

/** Recorre pantallas en los dos temas; un paso por pantalla. */
async function recorrer(ctx, s, rotulo, pantallas) {
  const resultados = {};
  for (const tema of ["light", "dark"]) {
    await ponerTema(s, tema).catch(() => {});
    for (const [nombre, ruta, esperaTexto] of pantallas) {
      const clave = nombre;
      resultados[clave] = resultados[clave] || [];
      try {
        const antes = s.log.problems().length;
        await s.page.goto(ruta);
        await s.page.waitForLoadState("networkidle").catch(() => {});
        if (esperaTexto) await s.page.getByText(esperaTexto).last().waitFor({ timeout: 12000 }).catch(() => resultados[clave].push(`${tema}: no apareció «${esperaTexto}»`));
        await s.page.waitForTimeout(900);
        const tem = await s.page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        if (tem !== tema) resultados[clave].push(`${tema}: la pantalla quedó con data-theme=${tem}`);
        await s.shot(`j-${rotulo}-${nombre}`, { fullPage: true });
        const t = await texto(s.page);
        const mala = MALAS.exec(t);
        if (mala) resultados[clave].push(`${tema}: el texto de la pantalla contiene «${mala[0]}»`);
        const ancho = await s.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
        if (ancho.sw > ancho.iw + 1) resultados[clave].push(`${tema}: desborde horizontal (${ancho.sw}px en una ventana de ${ancho.iw}px)`);
        const nuevos = s.log.problems().slice(antes).filter((e) => !/WebSocket connection/.test(e.text || ""));
        if (nuevos.length) resultados[clave].push(`${tema}: ${nuevos.slice(0, 2).map((e) => `${e.type} ${(e.url || e.text || "").replace(/^https?:\/\/[^/]+/, "").slice(0, 110)} ${e.status || ""}`).join(" || ")}`);
      } catch (e) {
        resultados[clave].push(`${tema}: ${String(e.message).split("\n")[0].slice(0, 160)}`);
      }
    }
  }
  for (const [nombre] of pantallas) {
    await ctx.paso(`${rotulo} · ${nombre}: claro y oscuro sin errores, sin desborde y sin textos rotos (captura en evidence/ens/j-${rotulo}-${nombre}_*)`, async () => {
      const r = resultados[nombre];
      afirmar(!r.length, r.join(" · "));
    });
  }
}

export async function correr(ctx) {
  const admTok = await tokenAdmin(8);
  const marca = Math.random().toString(36).slice(2, 6);
  const com = await cuenta("employer", "j-bar", { fullName: "Dueña Visual", profile: { name: `Bar Visual ${marca}`, description: "Café de especialidad y cocina de mercado, abierto todos los días." } });
  const w1 = await cuenta("worker", "j-mozo", { fullName: `Ana Visual ${marca}` });
  const w2 = await cuenta("worker", "j-barra", { fullName: `Beto Visual ${marca}` });
  for (const u of [w1, w2]) await verificarPorApi(u, admTok);

  // Datos para que las pantallas tengan contenido real.
  let abierto, tomado, hecho;
  await ctx.paso("Preparación: un turno con dos postulantes, uno confirmado con chat y uno ya trabajado, pagado y calificado (por API)", async () => {
    abierto = await turno(com, { inicioH: 70 });
    estado(await postular(w1, abierto.id), [200, 201], "postular");
    estado(await postular(w2, abierto.id), [200, 201], "postular");
    tomado = await confirmado(com, w1, { inicioH: 30, position: "bartender" });
    estado(await kit.api("POST", `/chats/${tomado.id}/messages`, { token: com.token, body: { body: "Hola Ana, ¿confirmás el horario de mañana?" } }), [200, 201], "chat");
    estado(await kit.api("POST", `/chats/${tomado.id}/messages`, { token: w1.token, body: { body: "Sí, llego 15 minutos antes." } }), [200, 201], "chat");
    hecho = await confirmado(com, w2, { inicioH: 3, position: "barista" });
    kit.db(`update shifts set start_at = now() - interval '5 hours 10 minutes', end_at = now() - interval '10 minutes', confirmed_at = now() - interval '2 days' where id = '${hecho.id}'`);
    estado(await kit.api("POST", `/shifts/${hecho.id}/check-in`, { token: w2.token, body: { latitude: -34.58755, longitude: -58.43095 } }), 200, "check-in");
    estado(await kit.api("POST", `/shifts/${hecho.id}/check-out`, { token: w2.token, body: { latitude: -34.58755, longitude: -58.43095 } }), 200, "check-out");
    estado(await kit.api("POST", `/shifts/${hecho.id}/finish`, { token: com.token }), 200, "finish");
    estado(await kit.api("POST", `/shifts/${hecho.id}/mark-paid`, { token: com.token }), 200, "pagado");
    estado(await kit.api("POST", `/reviews/shifts/${hecho.id}`, { token: com.token, body: { rating: 5, comment: "Muy buena atención" } }), [200, 201], "reseña");
    estado(await kit.api("POST", "/support/tickets", { token: w1.token, body: { category: "pagos", subject: `Consulta visual ${marca}`, body: "Una consulta para ver la pantalla." } }), [200, 201], "ticket");
  }, { critico: true });

  // ── Persona (390) ──
  const sw = await ctx.sesion({ name: "ens-j-persona", viewport: "mobile", theme: "light", geo: { lat: -34.5775, lng: -58.4256 } });
  await kit.loginAs(sw.page, w1);
  await recorrer(ctx, sw, "persona", [
    ["inicio", "/feed", "Hola"],
    ["buscar", "/buscar", null],
    ["mapa", "/map", null],
    ["mis-turnos", "/my-shifts", "Mis turnos"],
    ["chats", "/chats", null],
    ["chat", `/chats/${tomado.id}`, "confirmás el horario"],
    ["turno-publico", `/turno/${abierto.id}`, "Postul"],
    ["perfil", "/profile", null],
    ["editar-perfil", "/profile/edit", null],
    ["asistente", "/assistant", null],
    ["soporte", "/support", null],
    ["terminos", "/terminos", null],
  ]);

  // ── Comercio (390) ──
  const sc = await ctx.sesion({ name: "ens-j-comercio", viewport: "mobile", theme: "light", geo: { lat: -34.58755, lng: -58.43095 } });
  await kit.loginAs(sc.page, com);
  const comercio = [
    ["panel", "/shifts", null],
    ["publicar", "/shifts/new", "¿Qué necesitás?"],
    ["candidatos", `/shifts/${abierto.id}/candidates`, "Postulantes"],
    ["buscar-personas", "/search", null],
    ["chats", "/chats", null],
    ["chat", `/chats/${tomado.id}`, "Sí, llego"],
    ["perfil", "/profile", null],
    ["editar-perfil", "/profile/edit", "Datos del comercio"],
    ["evento", "/shifts/new-event", null],
    ["mi-plan", "/subscription", null],
    ["soporte", "/support", null],
    ["ficha-persona", `/workers/${w2.profile.id}`, "Beto Visual"],
  ];
  await recorrer(ctx, sc, "comercio", comercio);

  // ── Comercio y Candidatos en 1280 ──
  const sd = await ctx.sesion({ name: "ens-j-comercio-escritorio", viewport: "desktop", theme: "light", geo: { lat: -34.58755, lng: -58.43095 } });
  await kit.loginAs(sd.page, com);
  await recorrer(ctx, sd, "comercio-1280", [
    ["panel", "/shifts", null],
    ["candidatos", `/shifts/${abierto.id}/candidates`, "Postulantes"],
    ["publicar", "/shifts/new", "¿Qué necesitás?"],
    ["perfil", "/profile", null],
  ]);

  // ── Admin (390 y 1280) ──
  const pantallasAdmin = [
    ["hoy", "/admin", null],
    ["en-vivo", "/admin/en-vivo", null],
    ["personas", "/admin/personas", null],
    ["ficha", `/admin/personas/${w1.userId}`, `Ana Visual`],
    ["verificacion", "/admin/verificacion", null],
    ["soporte", "/admin/support", null],
    ["crecimiento", "/admin/leads", null],
    ["metricas", "/admin/metricas", null],
    ["herramientas", "/admin/herramientas", null],
    ["seguridad", "/admin/seguridad", null],
  ];
  const am = await ctx.admin(8, { viewport: "mobile", theme: "light" });
  await recorrer(ctx, am, "admin", pantallasAdmin);
  const ad = await ctx.admin(8, { viewport: "desktop", theme: "light" });
  await recorrer(ctx, ad, "admin-1280", pantallasAdmin);

  await ctx.paso("Ninguna sesión del recorrido tuvo pedidos a hosts externos sin simulado (external-unrouted)", async () => {
    const sueltos = ctx.sesiones.flatMap((s) => s.log.of("external-unrouted").map((e) => `${s.name}: ${e.url}`));
    afirmar(!sueltos.length, [...new Set(sueltos)].slice(0, 5).join(" · "));
  });
  await ctx.paso("Cero errores de consola, de página, de CSP ni de red en todo el recorrido (todas las sesiones)", async () => {
    const malos = ctx.sesiones.flatMap((s) => s.log.problems().filter((e) => !/WebSocket connection/.test(e.text || "")).map((e) => `${s.name}: ${e.type} ${(e.url || e.text || "").replace(/^https?:\/\/[^/]+/, "").slice(0, 100)} ${e.status || ""}`));
    afirmar(!malos.length, `${malos.length} problemas: ${[...new Set(malos)].slice(0, 5).join(" · ")}`);
  });
}
