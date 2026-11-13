import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTurnoPublico } from "@/lib/turno-publico";

/**
 * Este layout no dibuja nada: está para cortar el turno que **no existe**
 * antes de llegar a la página.
 *
 * `/turno/[id]` tiene dos pantallas de «acá no hay nada», y las dos tienen
 * que responder 404 (así la caché del borde no las guarda, ver
 * `cloudflare/turno-cache.mjs`: un turno tomado puede volver a abrirse y la
 * copia lo mostraría cerrado). Next elige la pantalla según dónde se llame a
 * `notFound()`: el `not-found.tsx` de un segmento envuelve a su página pero
 * no a su layout.
 *
 * - Acá (layout), el turno que no existe → sube a `app/not-found.tsx`:
 *   «No encontramos esa página».
 * - En `page.tsx`, el turno que fue público y ya no está abierto → cae en el
 *   `not-found.tsx` de esta carpeta: «Este turno ya no está disponible».
 *
 * El turno se pide una sola vez por visita (`getTurnoPublico` va con `cache`).
 */
export default async function TurnoLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const turno = await getTurnoPublico(id);

  if (turno.estado === "no_encontrado") {
    notFound();
  }

  return children;
}
