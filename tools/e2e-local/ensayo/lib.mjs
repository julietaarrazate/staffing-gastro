// lib.mjs — piezas comunes del ensayo general: pasos con ✓/✗, informe y ayudas.
//
// Un escenario es un módulo que exporta `nombre` (una letra), `titulo` y
// `async function correr(ctx)`. Adentro se arma con `ctx.paso("nombre claro", fn)`:
// si `fn` tira, el paso queda ✗ con el motivo y el escenario sigue (salvo
// `{ critico: true }`, que lo corta porque los pasos siguientes dependen de éste).
// `ctx.noCubierto("nombre", "porqué")` deja constancia de lo que no se automatizó.

import fs from "node:fs";
import path from "node:path";
import * as kit from "../kit.mjs";

export { kit };
export const hora = (h) => new Date(Date.now() + h * 3600e3).toISOString();
export const min = (m) => new Date(Date.now() + m * 60e3).toISOString();

export class Falla extends Error {}

/** Afirma `cond`; si no, el paso falla con `msg`. */
export function afirmar(cond, msg) {
  if (!cond) throw new Falla(msg);
}
export function igual(actual, esperado, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(esperado)) {
    throw new Falla(`${msg}: esperaba ${JSON.stringify(esperado)} y vino ${JSON.stringify(actual)}`);
  }
}
/** Respuesta de la API: debe tener el estado esperado (número o lista). */
export function estado(res, esperado, msg) {
  const ok = Array.isArray(esperado) ? esperado.includes(res.status) : res.status === esperado;
  if (!ok) throw new Falla(`${msg}: esperaba HTTP ${esperado} y vino ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
}
export function contiene(texto, patron, msg) {
  const t = String(texto ?? "");
  const ok = patron instanceof RegExp ? patron.test(t) : t.includes(patron);
  if (!ok) throw new Falla(`${msg}: no aparece ${patron} en «${t.replace(/\s+/g, " ").slice(0, 300)}»`);
}

const fechaCorta = () => new Date().toISOString().slice(0, 10);

export function crearContexto({ browser, dirResultados }) {
  const escenarios = [];
  return {
    browser,
    escenarios,
    dirResultados,
    escenario(letra, titulo) {
      const esc = { letra, titulo, pasos: [], inicio: Date.now(), notas: [] };
      escenarios.push(esc);
      const ctx = {
        browser,
        esc,
        sesiones: [],
        /** Un paso. `fn` recibe nada; devuelve lo que quiera (se ignora). */
        async paso(nombre, fn, { critico = false } = {}) {
          const t0 = Date.now();
          const p = { nombre, estado: "ok", ms: 0, detalle: "" };
          esc.pasos.push(p);
          try {
            await fn();
          } catch (e) {
            p.estado = "falla";
            p.detalle = String(e?.message || e).split("\n").slice(0, 4).join(" ").slice(0, 700);
            if (!(e instanceof Falla)) p.detalle = `(error del guion o de la app) ${p.detalle}`;
            // Foto y texto de la pantalla donde falló, para poder mirarla.
            for (const s of ctx.sesiones) {
              try {
                if (s.page.isClosed()) continue;
                const f = await s.shot(`falla-${letra}-${esc.pasos.length}-${s.name}`.slice(0, 90), { fullPage: false });
                p.captura = p.captura || f;
                p.pantalla = p.pantalla || (await s.page.locator("body").innerText({ timeout: 2000 }).catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
              } catch {}
            }
            p.ms = Date.now() - t0;
            console.log(`  ✗ ${nombre}\n      ${p.detalle}`);
            if (critico) throw new Abortar(`corte: «${nombre}» era necesario para seguir`);
            return;
          }
          p.ms = Date.now() - t0;
          console.log(`  ✓ ${nombre}`);
        },
        noCubierto(nombre, porque) {
          esc.pasos.push({ nombre, estado: "no-cubierto", detalle: porque, ms: 0 });
          console.log(`  – ${nombre} (no cubierto: ${porque})`);
        },
        nota(texto) {
          esc.notas.push(texto);
          console.log(`  · ${texto}`);
        },
        /** Sesión de navegador registrada para fotos de falla y chequeo de problemas. */
        async sesion(opts) {
          const s = await kit.newSession(browser, { agent: "ens", ...opts });
          s._visto = 0;
          ctx.sesiones.push(s);
          return s;
        },
        /**
         * En la pantalla que se acaba de recorrer: `s.log.problems()` vacío
         * desde el último chequeo. `permitir`: lista de funciones/regex sobre
         * «tipo status url texto» para errores esperados (un 409 buscado, etc.).
         */
        async pantallaLimpia(s, nombre, permitir = []) {
          await ctx.paso(`Sin errores de consola ni de red en ${nombre}`, async () => {
            const todos = s.log.problems();
            const nuevos = todos.slice(s._visto);
            s._visto = todos.length;
            const reales = nuevos.filter((e) => {
              const clave = `${e.type} ${e.status ?? ""} ${e.method ?? ""} ${e.url ?? ""} ${e.text ?? ""} ${e.body ?? ""}`;
              return !permitir.some((p) => (p instanceof RegExp ? p.test(clave) : p(e, clave)));
            });
            if (reales.length) {
              throw new Falla(
                reales
                  .slice(0, 4)
                  .map((e) => `${e.type} ${e.status ?? ""} ${e.method ?? ""} ${(e.url || "").replace(/^https?:\/\/[^/]+/, "")} ${(e.text || e.body || e.error || "").slice(0, 140)}`)
                  .join(" || ")
              );
            }
          });
        },
        /**
         * Sesión de admin (login real con dos pasos). Las cuentas admin que crea
         * el arnés no tienen aceptados los Términos: si aparece el cartel, se
         * acepta (es artefacto del arnés, no del producto).
         */
        async admin(n, opts = {}) {
          const a = await kit.adminSession(browser, { agent: "ens", ...opts, n });
          a._visto = 0;
          ctx.sesiones.push(a);
          const acepto = a.page.getByRole("dialog", { name: "Actualizamos los Términos" }).getByRole("button", { name: "Acepto" });
          if (await acepto.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
            await acepto.click();
            await a.page.waitForTimeout(800);
          }
          return a;
        },
        async cerrar() {
          for (const s of ctx.sesiones) await s.close().catch(() => {});
          ctx.sesiones = [];
        },
      };
      return ctx;
    },
    informe(extra = {}) {
      const L = [];
      L.push(`# Ensayo general — ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`);
      L.push("");
      L.push(`Pila local con \`VERIFICACION_OBLIGATORIA=true\` y \`RECONFIRMACION_ENABLED=true\`. Terceros simulados (ver README del arnés).`);
      L.push("");
      let ok = 0, falla = 0, nc = 0;
      L.push("| Escenario | ✓ | ✗ | no cubiertos | duración |");
      L.push("|---|---|---|---|---|");
      for (const e of escenarios) {
        const c = (x) => e.pasos.filter((p) => p.estado === x).length;
        ok += c("ok"); falla += c("falla"); nc += c("no-cubierto");
        L.push(`| ${e.letra}. ${e.titulo} | ${c("ok")} | ${c("falla")} | ${c("no-cubierto")} | ${Math.round((e.fin - e.inicio) / 1000)} s |`);
      }
      L.push(`| **Total** | **${ok}** | **${falla}** | **${nc}** | |`);
      L.push("");
      for (const e of escenarios) {
        L.push(`## ${e.letra}. ${e.titulo}`);
        L.push("");
        for (const p of e.pasos) {
          const icono = p.estado === "ok" ? "✓" : p.estado === "falla" ? "✗" : "–";
          L.push(`- ${icono} ${p.nombre}${p.estado === "no-cubierto" ? ` — _no cubierto: ${p.detalle}_` : ""}`);
          if (p.estado === "falla") {
            L.push(`  - Motivo: ${p.detalle}`);
            if (p.pantalla) L.push(`  - Pantalla en ese momento: «${p.pantalla}»`);
            if (p.captura) L.push(`  - Captura: \`${p.captura}\``);
          }
        }
        for (const n of e.notas) L.push(`- Nota: ${n}`);
        L.push("");
      }
      if (extra.pie) L.push(extra.pie);
      return { texto: L.join("\n"), ok, falla, nc };
    },
  };
}

export class Abortar extends Error {}

export function guardarInforme(dir, texto, sufijo = "") {
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `ensayo-${fechaCorta()}${sufijo}.md`);
  fs.writeFileSync(archivo, texto);
  return archivo;
}

// ───────────────────────────── ayudas de datos ─────────────────────────────

export const CLAVE = kit.DEFAULT_PASSWORD;

/** Cuenta de persona (worker) o comercio por el camino real, con prefijo `ens-`. */
export async function cuenta(role, prefijo, extra = {}) {
  return kit.registerViaApi({ role, email: kit.uniq(`ens-${prefijo}`), ...extra });
}

/** Turno por API: crea y publica. Devuelve el turno. `inicioH` en horas desde ahora. */
export async function turno(com, { inicioH = 72, durH = 5, publicar = true, ...resto } = {}) {
  const body = {
    position: "mozo",
    quantity: 1,
    start_at: hora(inicioH),
    end_at: hora(inicioH + durH),
    pay_amount: "70000",
    city: "Palermo",
    address: "Gorriti 5000",
    latitude: -34.58755,
    longitude: -58.43095,
    ...resto,
  };
  const r = await kit.api("POST", "/shifts", { token: com.token, body });
  const t = estado(r, 201, "crear turno");
  if (publicar) estado(await kit.api("POST", `/shifts/${t.id}/publish`, { token: com.token }), 200, "publicar turno");
  return t;
}

export async function postular(w, shiftId) {
  return kit.api("POST", `/applications/shifts/${shiftId}`, { token: w.token });
}
export async function asignar(com, shiftId, w) {
  return kit.api("POST", `/shifts/${shiftId}/assign`, { token: com.token, body: { worker_profile_id: w.profile.id } });
}
export async function confirmar(w, shiftId) {
  return kit.api("POST", `/shifts/${shiftId}/confirm`, { token: w.token });
}

/** Postula, asigna y confirma (el camino corto por API para escenarios que prueban otra cosa). */
export async function confirmado(com, w, opts = {}) {
  const t = await turno(com, opts);
  estado(await postular(w, t.id), [200, 201], "postular");
  estado(await asignar(com, t.id, w), 200, "asignar");
  estado(await confirmar(w, t.id), 200, "confirmar");
  return t;
}

export async function leerTurno(token, id) {
  return (await kit.api("GET", `/shifts/${id}`, { token })).data;
}

export async function avisos(u, tipo) {
  const r = await kit.api("GET", "/notifications", { token: u.token });
  const lista = Array.isArray(r.data) ? r.data : [];
  return tipo ? lista.filter((n) => n.type === tipo) : lista;
}

/** Espera hasta que `fn` devuelva algo verdadero. */
export async function esperar(fn, que, ms = 60000, cada = 1500) {
  const t = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t > ms) throw new Falla(`no ocurrió a tiempo: ${que}`);
    await kit.sleep(cada);
  }
}

/** Despierta al scheduler publicando un turno propio (README del arnés). */
export async function despertarScheduler(com) {
  const r = await kit.api("POST", "/shifts", {
    token: com.token,
    body: { position: "runner", quantity: 1, start_at: hora(6000), end_at: hora(6005), pay_amount: "50000", city: "Palermo" },
  });
  if (r.ok) await kit.api("POST", `/shifts/${r.data.id}/publish`, { token: com.token });
}

/** Sube un archivo a la subida firmada (simulado) y devuelve la referencia que espera el backend. */
export async function subirEvidencia(w, kind, archivo, mime = "image/jpeg") {
  const fs_ = await import("node:fs");
  const sig = estado(await kit.api("POST", `/uploads/sign-image?kind=${kind}`, { token: w.token }), 200, "firmar subida").valueOf();
  const fd = new FormData();
  for (const [k, v] of Object.entries(sig)) fd.append(k, String(v));
  fd.append("file", new Blob([fs_.readFileSync(archivo)], { type: mime }), "doc.jpg");
  const res = await fetch(`http://127.0.0.1:8901/cloudinary/v1_1/oido-e1/image/upload`, { method: "POST", body: fd });
  const body = await res.json();
  if (!res.ok) throw new Falla(`subida simulada ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  return { public_id: body.public_id, resource_type: "image", format: "jpg", type: "authenticated" };
}

/**
 * Verifica la identidad de una persona por el camino real pero sin pantallas:
 * sube DNI + selfie, los envía y una admin aprueba la solicitud (por API).
 */
export async function verificarPorApi(w, adminToken) {
  const frente = await subirEvidencia(w, "identity", kit.assets.dniFrente);
  const dorso = await subirEvidencia(w, "identity", kit.assets.dniDorso);
  const selfie = await subirEvidencia(w, "identity", kit.assets.selfie);
  estado(await kit.api("POST", "/identity/me/document", { token: w.token, body: { dni_frente: frente, dni_dorso: dorso, selfie } }), 200, "enviar documentos");
  const cola = estado(await kit.api("GET", "/identity/claims/pending", { token: adminToken }), 200, "cola de verificación");
  const claim = cola.find((c) => c.user_id === w.userId);
  afirmar(claim, "la solicitud no aparece en la cola de la admin");
  estado(await kit.api("POST", `/identity/claims/${claim.claim_id}/approve`, { token: adminToken, body: { submitted_at: claim.submitted_at } }), 200, "aprobar");
}

export async function tokenAdmin(n) {
  return kit.adminApiToken(n);
}

/** Cuerpo de texto de la pantalla, en una línea. */
export async function texto(page) {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

/** Click por nombre accesible, esperando que exista. */
export async function tocar(page, nombre, opts = {}) {
  const loc = typeof nombre === "string" ? page.getByRole("button", { name: nombre, ...opts }).first() : page.getByRole("button", { name: nombre, ...opts }).first();
  await loc.click({ timeout: 15000 });
}

export const aFechaLocal = (h) => new Date(Date.now() + h * 3600e3 - 3 * 3600e3).toISOString().slice(0, 16); // ART = UTC-3
