#!/usr/bin/env node
// ensayo.mjs — ensayo general antes de abrir la beta.
//
//   node tools/e2e-local/ensayo/ensayo.mjs                 # todos los escenarios
//   node tools/e2e-local/ensayo/ensayo.mjs --solo B        # uno (letra)
//   node tools/e2e-local/ensayo/ensayo.mjs --solo A,C,D    # varios
//
// Requiere la pila levantada con VERIFICACION_OBLIGATORIA=true y
// RECONFIRMACION_ENABLED=true (ver README → «Ensayo general»). Informe en
// $E1_DIR/results/ensayo-<fecha>.md; código de salida 1 si algún paso falla.
// No arregla nada: lo que no se cumple es un hallazgo.

import path from "node:path";
import { fileURLToPath } from "node:url";
import * as kit from "../kit.mjs";
import { crearContexto, guardarInforme, Abortar } from "./lib.mjs";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ORDEN = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
const args = process.argv.slice(2);
const iSolo = args.indexOf("--solo");
const solo = iSolo >= 0 ? String(args[iSolo + 1] || "").toLowerCase().split(",").filter(Boolean) : null;
const letras = ORDEN.filter((l) => !solo || solo.includes(l));
if (!letras.length) {
  console.error(`--solo no reconoce ${args[iSolo + 1]} (letras válidas: ${ORDEN.join(", ").toUpperCase()})`);
  process.exit(2);
}

// La pila tiene que estar arriba y con la configuración de producción.
for (const [nombre, url] of [["backend", "http://127.0.0.1:8000/health"], ["frontend", "http://127.0.0.1:3100/login"], ["simulados", "http://127.0.0.1:8901/health"]]) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
  } catch (e) {
    console.error(`✗ ${nombre} no responde (${url}). Levantá la pila: tools/e2e-local/start_all.sh`);
    process.exit(2);
  }
}

const browser = await kit.launch();
const dirResultados = path.join(kit.E1, "results");
const ctxGlobal = crearContexto({ browser, dirResultados });
process.env.E1_AGENT = "ens";

let corte = false;
for (const letra of letras) {
  const archivos = (await import("node:fs")).readdirSync(aqui).filter((f) => f.toLowerCase().startsWith(`${letra}-`) && f.endsWith(".mjs"));
  if (!archivos.length) {
    console.log(`\n(no hay escenario ${letra.toUpperCase()})`);
    continue;
  }
  const mod = await import(path.join(aqui, archivos[0]));
  console.log(`\n══ ${mod.letra}. ${mod.titulo}`);
  const ctx = ctxGlobal.escenario(mod.letra, mod.titulo);
  try {
    await mod.correr(ctx);
  } catch (e) {
    if (e instanceof Abortar) console.log(`  ! ${e.message}`);
    else {
      ctx.esc.pasos.push({ nombre: "El escenario se cortó por un error inesperado", estado: "falla", detalle: String(e?.stack || e).slice(0, 600), ms: 0 });
      console.log(`  ✗ El escenario se cortó: ${e?.message || e}`);
    }
  } finally {
    ctx.esc.fin = Date.now();
    await ctx.cerrar();
  }
}
await browser.close();

const { texto, ok, falla, nc } = ctxGlobal.informe({
  pie: `Capturas: \`${path.join(kit.EVIDENCE, "ens")}\` · registro de la base: \`${path.join(kit.LOGS, "db.jsonl")}\``,
});
const archivo = guardarInforme(dirResultados, texto, solo ? `-solo-${letras.join("")}` : "");
console.log(`\n══ Resultado: ${ok} ✓ · ${falla} ✗ · ${nc} no cubiertos`);
console.log(`Informe: ${archivo}`);
process.exit(falla ? 1 : 0);
