import type { Metadata } from "next";
import PaginaAviso from "@/components/PaginaAviso";

/**
 * «No encontrada» de toda la app: cualquier dirección que no existe y todo
 * `notFound()` que no tenga una pantalla más cerca (por ejemplo el link de un
 * turno que no existe, ver `app/turno/[id]/layout.tsx`). Sin este archivo
 * salía la de Next: «404 | This page could not be found.», en inglés y sin
 * ninguna salida.
 *
 * «Volver al inicio» va a `/`, que sirve para cualquiera: con sesión lleva a
 * la pantalla principal de cada rol y sin sesión muestra qué es Oído.
 */
export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <PaginaAviso
      titulo="No encontramos esa página"
      texto="Puede que el link esté mal escrito o que la página ya no exista."
      principal={{ label: "Volver al inicio", href: "/" }}
    />
  );
}
