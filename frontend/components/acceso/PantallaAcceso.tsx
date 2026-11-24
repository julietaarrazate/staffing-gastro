"use client";

import Image from "next/image";
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
 * formulario. En la tablet, la hoja angosta y centrada sobre el cielo, como las
 * subpáginas del perfil. En la compu (desde `lg`, 2026-11-24), dos columnas en el
 * marco de la app (`--app-frame`): a la izquierda el cielo grande con el título,
 * qué es Oído y dos fotos de la landing; a la derecha, la hoja con el formulario.
 * En el celular no cambia nada: lo de la compu va detrás de `lg:`.
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
        "lg:max-w-[var(--app-frame)] lg:flex-row lg:items-stretch lg:px-6 lg:pb-12 lg:pt-[max(2.5rem,9vh)]",
        conBarra
          ? "min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))]"
          : "-mb-[var(--chrome-bottom)] min-h-[calc(100dvh-var(--chrome-top))]"
      )}
    >
      <div className="app-cielo cielo-limpio px-4 pb-12 pt-4 md:rounded-t-[28px] md:px-6 md:pt-6 lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:rounded-l-[28px] lg:rounded-tr-none lg:px-10 lg:pb-10 lg:pt-9">
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
        <h1 className="titulo-pantalla mt-4 break-words lg:mt-14">{titulo}</h1>
        {bajada && <p className="mt-1.5 break-words text-sm font-medium lg:mt-3 lg:text-base">{bajada}</p>}
        {/* Qué es Oído: sólo a quien todavía no tiene sesión (no en la bienvenida ni al
            confirmar el email estando adentro). */}
        {!user && <QueEsOido />}
      </div>
      <div className="hoja acceso-hoja -mt-7 flex flex-1 flex-col px-4 pb-8 pt-6 md:px-6 lg:mt-0 lg:w-[440px] lg:flex-none lg:justify-center lg:rounded-l-none lg:rounded-r-[28px] lg:px-10 lg:py-10">
        {children}
      </div>
    </div>
  );
}

/** Lo que es Oído, sólo en la compu y sin sesión (en el celular el formulario va primero). */
const PUNTOS = [
  "El comercio publica el turno en un minuto y elige a quién va.",
  "Quien trabaja elige el turno y sabe cuánto cobra antes de ir.",
  "Se ve quién tiene la identidad verificada.",
] as const;

function QueEsOido() {
  return (
    <div className="mt-auto hidden pt-10 lg:block">
      <p className="text-lg font-bold">Turnos de gastronomía en CABA, en el momento.</p>
      <ul className="mt-3 space-y-2">
        {PUNTOS.map((p) => (
          <li key={p} className="flex gap-2.5 text-fila font-medium leading-snug">
            <span aria-hidden className="mt-[7px] size-2 flex-none rounded-full bg-current opacity-70" />
            {p}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex gap-4" aria-hidden>
        {(["mozo3", "cocina1"] as const).map((f, i) => (
          <div
            key={f}
            className={cn(
              "relative h-44 w-36 overflow-hidden rounded-2xl shadow-[var(--shadow-float)] ring-4 ring-[color:var(--color-card)]",
              i === 0 ? "-rotate-3" : "translate-y-3 rotate-2"
            )}
          >
            <Image src={`/landing/${f}.webp`} alt="" fill sizes="144px" className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
