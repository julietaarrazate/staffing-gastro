// Corre `npm audit` y falla con avisos de severidad alta o crítica, igual que
// `npm audit --audit-level=high`, salvo los de EXCEPCIONES. Cada excepción
// tiene motivo y fecha de vencimiento: pasada la fecha, el control vuelve a
// fallar aunque el aviso siga, para obligar a revisarla. Decisión y detalle en
// docs/reference/SECURITY.md («Excepciones del control de dependencias»).
import { execFileSync } from "node:child_process";

const EXCEPCIONES = {
  // picomatch: ReDoS sin versión corregida publicada (la última, 4.0.7, está
  // en el rango afectado). Llega sólo por herramientas de build y de pruebas.
  "GHSA-fc5q-39xc-vjpf": { vence: "2026-12-17", motivo: "picomatch sin versión corregida" },
};

const GRAVES = new Set(["high", "critical"]);
const hoy = new Date().toISOString().slice(0, 10);

let salida;
try {
  salida = execFileSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  // npm audit sale con código 1 cuando encuentra avisos: el JSON viene igual.
  salida = error.stdout;
}
const reporte = JSON.parse(salida);

const avisos = new Map();
for (const vuln of Object.values(reporte.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via !== "object" || !via.url) continue;
    const id = via.url.split("/").pop();
    avisos.set(id, { id, severidad: via.severity, paquete: via.name, titulo: via.title });
  }
}

const bloqueantes = [];
for (const aviso of avisos.values()) {
  if (!GRAVES.has(aviso.severidad)) continue;
  const excepcion = EXCEPCIONES[aviso.id];
  if (excepcion && hoy <= excepcion.vence) {
    console.log(`Exceptuado hasta ${excepcion.vence}: ${aviso.id} (${aviso.paquete}) · ${excepcion.motivo}`);
    continue;
  }
  if (excepcion) console.log(`La excepción de ${aviso.id} venció el ${excepcion.vence}: hay que revisarla.`);
  bloqueantes.push(aviso);
}

for (const [id, excepcion] of Object.entries(EXCEPCIONES)) {
  if (!avisos.has(id)) console.log(`La excepción de ${id} ya no hace falta: sacala de .github/scripts/npm-audit.mjs.`);
}

if (bloqueantes.length > 0) {
  console.error(`\n${bloqueantes.length} aviso(s) de severidad alta o crítica:`);
  for (const a of bloqueantes) console.error(`- ${a.id} [${a.severidad}] ${a.paquete}: ${a.titulo}`);
  process.exit(1);
}
console.log(`\nSin avisos de severidad alta o crítica fuera de las excepciones (${avisos.size} avisos en total).`);
