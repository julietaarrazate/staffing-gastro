// Copia a public/ lo que el video usa y vive en otro lado del repo (sin duplicarlo en git):
// los vectores de la marca, las nubes de la app y los recortes de sonido.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
const aqui = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repo = path.resolve(aqui, "../..");
const copiar = (desde, hacia, filtro) => {
  mkdirSync(hacia, { recursive: true });
  for (const f of readdirSync(desde)) if (filtro.test(f)) cpSync(path.join(desde, f), path.join(hacia, f));
};
copiar(path.join(repo, "docs/design-system/marca"), path.join(aqui, "public/marca"), /\.svg$/);
copiar(path.join(repo, "frontend/public/cielo"), path.join(aqui, "public/marca"), /\.webp$/);
copiar(path.join(aqui, "sonidos"), path.join(aqui, "public/sonidos"), /\.mp3$/);
if (!existsSync(path.join(aqui, "public/cap"))) {
  console.log("Ojo: falta public/cap/ (las capturas de la app). Las piezas que muestran la app las necesitan:");
  console.log("  ver «Capturas de la app» en README.md. Las tres de redes (que-resuelve-oido, para-comercios, para-trabajadores) andan sin ellas.");
}
console.log("public/ listo");
