// Parche a @opennextjs/cloudflare 1.20.13 (corre en el `postinstall`).
// (sigue haciendo falta en 1.20.13: su patrón todavía no incluye preview-props).
//
// Next 16.4 lee un manifiesto nuevo, `.next/server/preview-props.json`, y
// OpenNext no lo empaqueta en el Worker: sin esto TODAS las páginas dan 500
// ("Unexpected loadManifest(...preview-props.json) call!"). Es el mismo bug
// que OpenNext arregló en 1.17.3 para `prefetch-hints.json`. Al subir
// OpenNext, probar sin el parche y borrarlo si ya no hace falta.
//
// Script propio y no `patch-package`: esa herramienta trae dependencias con
// avisos "high" de `npm audit` (braces), que el CI de Security rechaza.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const FILE =
  "node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/load-manifest.js";
const BEFORE = "{*-manifest,required-server-files,prefetch-hints}.json";
const AFTER = "{*-manifest,required-server-files,prefetch-hints,preview-props}.json";

if (!existsSync(FILE)) {
  // Instalación sin dependencias de desarrollo (no hay OpenNext): nada que hacer.
  process.exit(0);
}
const src = readFileSync(FILE, "utf8");
if (src.includes(AFTER)) process.exit(0);
if (!src.includes(BEFORE)) {
  console.error(
    "[patch-opennext] cambió el código de OpenNext: revisar si el parche sigue haciendo falta.",
  );
  process.exit(1);
}
writeFileSync(FILE, src.replace(BEFORE, AFTER));
console.log("[patch-opennext] preview-props.json incluido en el Worker.");
