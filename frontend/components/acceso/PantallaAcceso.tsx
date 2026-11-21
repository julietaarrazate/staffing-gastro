"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";
import Logo from "@/components/Logo";
import { NubesCielo, PasosTachados } from "@/components/ui";

/**
 * La cáscara de las pantallas de acceso (`/login`, `/register`, `/recuperar`,
 * `/restablecer`, `/verificar-email`) y de la bienvenida con la dirección suave
 * (ADR-0028, 2026-11-21): arriba el cielo con el «oído» plano (el mismo del
 * Inicio) y el título de la pantalla en letra normal; debajo, la hoja con el
 * formulario. En la compu, la hoja angosta y centrada sobre el cielo, como las
 * subpáginas del perfil.
 *
 * - `pasos`: la bienvenida pone sus pasos tachados entre el «oído» y el título.
 * - Sin sesión no hay barra de abajo ni encabezado (el «oído» del cielo lleva
 *   al inicio): la pantalla ocupa el lugar que el layout le reserva a la barra.
 *   Con sesión (confirmar el email estando adentro) queda sobre la barra.
 *   La bienvenida nunca lleva barras.
 */
export default function PantallaAcceso({
  titulo,
  bajada,
  pasos,
  children,
}: {
  titulo: string;
  /** Una línea debajo del título, sobre el cielo. */
  bajada?: string;
  pasos?: { active: number; labels: readonly string[] };
  children: ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const conBarra = Boolean(user) && pathname !== "/bienvenida";
  return (
    <div
      className={cn(
        "estilo-suave acceso mx-auto flex max-w-md flex-col md:mb-0 md:min-h-0 md:max-w-[28rem] md:px-4 md:pb-10 md:pt-8",
        conBarra
          ? "min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))]"
          : "-mb-[var(--chrome-bottom)] min-h-[calc(100dvh-var(--chrome-top))]"
      )}
    >
      <div className="app-cielo cielo-limpio px-4 pb-12 pt-4 md:rounded-t-[28px] md:px-6 md:pt-6">
        {/* Una nube grande arriba a la derecha, detrás del «oído» y del título
            (en tinta se lee sobre el blanco de la nube); de noche no hay. Entera
            dentro del ancho: la auditoría de encuadre no deja nada fuera. */}
        <NubesCielo nubes={[{ forma: "a", ancho: 230, pos: { right: 0, top: -6 } }]} />
        <Link href="/" aria-label="Inicio" className="inline-flex min-h-11 items-center rounded-lg">
          <Logo size={32} sobreCielo />
        </Link>
        {pasos && (
          <PasosTachados active={pasos.active} labels={pasos.labels} tono="cielo" className="mt-3" />
        )}
        <h1 className="titulo-pantalla mt-4 break-words">{titulo}</h1>
        {bajada && <p className="mt-1.5 break-words text-sm font-medium">{bajada}</p>}
      </div>
      <div className="hoja acceso-hoja -mt-7 flex flex-1 flex-col px-4 pb-8 pt-6 md:px-6">{children}</div>
    </div>
  );
}
