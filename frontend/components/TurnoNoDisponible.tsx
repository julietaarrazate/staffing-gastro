"use client";

import { useAuth } from "@/lib/auth-context";
import PaginaAviso, { type SalidaDeAviso } from "@/components/PaginaAviso";
import { Skeleton } from "@/components/ui";

type Salidas = { principal: SalidaDeAviso; secundaria?: SalidaDeAviso };

// A dónde tiene sentido ir desde acá, según quién mira. «Ver otros turnos»
// sólo se le ofrece a quien puede verlos: el Inicio pide sesión de trabajador.
const SALIDAS: Record<string, Salidas> = {
  worker: {
    principal: { label: "Ver otros turnos", href: "/feed" },
    // Si se había postulado a este turno, ahí ve en qué quedó.
    secundaria: { label: "Ver mis turnos", href: "/my-shifts" },
  },
  employer: { principal: { label: "Ir a mi panel", href: "/shifts" } },
  admin: { principal: { label: "Ir al panel", href: "/admin" } },
};

// Quien llega por un link compartido casi siempre es un trabajador: mismo
// destino que «Postulate en Oído» en el turno abierto (`ShiftDetail`). Y
// «Ya tengo cuenta» para quien abrió el link en un navegador donde no entró.
const SIN_SESION: Salidas = {
  principal: { label: "Crear mi perfil gratis", href: "/register?rol=trabajador" },
  secundaria: { label: "Ya tengo cuenta", href: "/login" },
};

/**
 * `/turno/[id]` cuando el turno fue público y ya no está abierto: se tomó, el
 * comercio lo canceló, quedó sin cubrir o pasó la hora (la API contesta 410,
 * ver `lib/turno-publico.ts`). Antes ese link mostraba la página 404 de Next,
 * en inglés y sin salida, y es el caso más común de un link de WhatsApp que
 * se abre horas después.
 *
 * No muestra nada del turno: la API no lo manda, a propósito.
 */
export default function TurnoNoDisponible() {
  const { user, loading } = useAuth();
  const salidas = user ? (SALIDAS[user.role] ?? SALIDAS.worker) : SIN_SESION;

  return (
    <PaginaAviso
      titulo="Este turno ya no está disponible"
      texto="Ya se cubrió o el comercio lo dio de baja."
      {...(loading ? {} : salidas)}
    >
      {/* La sesión se lee en el navegador: hasta saberlo no se muestra una
          salida que después cambie por otra (mismo criterio que la acción de
          `ShiftDetail`). */}
      {loading && <Skeleton className="h-14 w-full rounded-[var(--radius-btn)]" />}
    </PaginaAviso>
  );
}
