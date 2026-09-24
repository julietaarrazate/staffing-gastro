import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * La escala tipográfica (`--text-*` en app/globals.css) es la única fuente de
 * tamaños de texto. Medido el 2026-09-24 había 78 tamaños escritos a mano
 * (`text-[15px]`, `text-[10px]`…), y el cuerpo real de la app (14px) ni
 * siquiera estaba en la escala. Este test evita la recaída: un tamaño nuevo
 * se agrega como token, no como número suelto.
 *
 * Excepciones permitidas, con motivo:
 * - contadores dentro de un círculo o badge de alto fijo (campana, marcador
 *   del mapa, stepper), donde el piso de 11px no entra;
 * - el onboarding (`/bienvenida`), pantalla de marca con su propio título;
 * - el número grande de "Turnos activos", que es una cifra de hero.
 */
const PERMITIDOS: Record<string, string[]> = {
  "components/NotificationBell.tsx": ["text-[10px]"],
  "components/ShiftLifecycleStepper.tsx": ["text-[10px]"],
  "components/map/WorkerMarker.tsx": ["text-[9px]"],
  "app/bienvenida/page.tsx": ["text-[2rem]"],
  "components/employer/ActiveShiftsCard.tsx": ["text-[40px]"],
};

const ROOT = join(__dirname, "..");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) ? [ruta] : [];
  });
}

describe("escala tipográfica", () => {
  it("no hay tamaños de texto escritos a mano fuera de las excepciones", () => {
    const sueltos: string[] = [];
    for (const ruta of [...archivos(join(ROOT, "app")), ...archivos(join(ROOT, "components"))]) {
      const rel = relative(ROOT, ruta);
      const permitidos = PERMITIDOS[rel] ?? [];
      for (const m of readFileSync(ruta, "utf8").matchAll(/text-\[[0-9.]+(?:px|rem)\]/g)) {
        if (!permitidos.includes(m[0])) sueltos.push(`${rel}: ${m[0]}`);
      }
    }
    expect(sueltos).toEqual([]);
  });
});
