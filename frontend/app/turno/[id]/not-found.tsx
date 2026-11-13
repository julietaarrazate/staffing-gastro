import TurnoNoDisponible from "@/components/TurnoNoDisponible";

/**
 * Lo que se ve cuando `page.tsx` corta con `notFound()`: el turno fue público
 * y ya no está abierto. El turno que directamente no existe no llega hasta
 * acá: lo corta `layout.tsx` y muestra la pantalla global.
 */
export default function TurnoNotFound() {
  return <TurnoNoDisponible />;
}
