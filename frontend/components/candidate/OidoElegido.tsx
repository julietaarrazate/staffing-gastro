"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Filete from "@/components/landing/Filete";
import { NubesCielo } from "@/components/ui";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { cldThumb } from "@/lib/cloudinary";
import { firstNameOf } from "@/lib/shift-next-step";
import { useEscapeLayer } from "@/lib/use-escape-layer";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { iniciales } from "./CandidatoDestacado";

/**
 * «¡Oído!»: lo que ve el comercio apenas elige a alguien (dirección suave,
 * ADR-0028; maqueta `C-Oido` de la prueba de identidad por pantalla). Es el
 * momento de marca de la app: el cielo entero con un banco de nubes abajo, la
 * foto del local y la de la persona que llegan de los costados, y la cinta
 * «¡Oído!» (la dibuja `Filete.tsx`) que cae como un sello. El movimiento se
 * apaga con «reducir movimiento» (`globals.css`, `.oido-*`).
 *
 * Tapa toda la pantalla, también el encabezado y la barra de abajo: es un
 * diálogo (foco atrapado, Escape vuelve al panel). No decide nada: el turno ya
 * quedó asignado cuando se muestra, y la persona todavía tiene que confirmar,
 * así que el texto no dice que «toma» el turno.
 */
export default function OidoElegido({
  nombre,
  foto,
  local,
  fotoLocal,
  fotoLocalEsLogo = false,
  detalle,
  chatHref,
  panelHref,
  onCerrar,
}: {
  /** Nombre completo de la persona elegida. */
  nombre: string;
  foto: string | null;
  /** Nombre del local (para su foto o sus iniciales). */
  local: string | null;
  fotoLocal: string | null;
  /** La foto del local es su logo: va entero sobre blanco, sin recortar. */
  fotoLocalEsLogo?: boolean;
  /** «Cocinero/a, hoy a las 21:00.» */
  detalle: string | null;
  chatHref: string;
  panelHref: string;
  /** Escape: lo mismo que «Volver al panel». */
  onCerrar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const bajadaId = useId();
  // Se monta recién después de elegir (un toque), así que ya hay `document`.
  useFocusTrap(ref, true);
  useEscapeLayer(true, onCerrar, 60);
  // La pantalla de atrás no scrollea mientras tanto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const primerNombre = firstNameOf(nombre) ?? nombre;

  // En `document.body`, como `Modal` y `Sheet`: un ancestro con `transform`
  // le rompería el `position: fixed`.
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      aria-describedby={bajadaId}
      data-testid="oido-elegido"
      className="estilo-suave fixed inset-0 z-[60]"
    >
      {/* El cielo va en una caja propia: `.app-cielo` trae su `position`, que
          le ganaría al `fixed` del diálogo. */}
      <div className="app-cielo cielo-limpio h-full w-full">
        {/* Una nube grande que asoma arriba a la izquierda, una chica de lejos
            y el banco de abajo, como el cierre de la landing. Quedan quietas
            aunque el contenido scrollee (pantallas muy bajas). */}
        <NubesCielo
          nubes={[
            { forma: "a", ancho: 300, pos: { left: -130, top: 60 } },
            { forma: "b", ancho: 90, pos: { right: 26, top: 96 }, lejos: true },
            // El banco no pasa de 760 px: más ancho, también crece en alto y
            // se mete detrás de la cinta y del texto. En la compu lo completa
            // otro banco del otro lado.
            { forma: "c", ancho: "clamp(560px, 144%, 760px)", pos: { left: "max(-15%, -110px)", bottom: -34 } },
            { forma: "b", ancho: 230, pos: { right: -70, bottom: 54 }, className: "md:hidden" },
            { forma: "c", ancho: 760, pos: { right: -120, bottom: -70 }, className: "max-md:hidden" },
          ]}
        />
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto flex min-h-full max-w-md flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-center">
            <div className="flex">
              <Link href={panelHref} aria-label="Cerrar y volver al panel" className="boton-vidrio h-11 w-11">
                <CloseIcon size={22} />
              </Link>
            </div>

            {/* Las dos fotos: el local a la izquierda y la persona a la derecha,
                torcidas y encimadas, con el tilde en el medio. Las medidas van
                en porcentaje de la caja (342 × 262 en la maqueta), que se achica
                en pantallas angostas o bajas. */}
            <div className="relative mx-auto mt-4 aspect-[342/262] w-[min(342px,100%,42dvh)] shrink-0">
              <Retrato
                className="oido-llega-izq left-[6.4%] top-[3%] -rotate-[7deg]"
                src={fotoLocal}
                nombre={local ?? "El local"}
              sinIniciales={!local}
                entero={fotoLocalEsLogo}
                posicion="62% 30%"
              />
              <Retrato
                className="oido-llega-der right-[6.4%] top-[15.3%] rotate-[6deg]"
                src={foto}
                nombre={nombre}
                posicion="50% 18%"
              />
              <span
                aria-hidden
                className="oido-tilde absolute left-1/2 top-[41%] flex aspect-square w-[17.5%] -translate-x-1/2 items-center justify-center rounded-full bg-white text-[#1c5478]"
              >
                <CheckIcon size={30} strokeWidth={2.6} className="h-1/2 w-1/2" />
              </span>
            </div>

            <div aria-hidden className="oido-sello mx-auto mt-1 w-[min(320px,88%,40dvh)] shrink-0">
              <Filete palabra="¡Oído!" tam="cinta" className="block h-auto w-full" />
            </div>

            <h1 id={tituloId} className="mt-1 break-words text-[length:var(--text-pago)] font-extrabold leading-[1.15] tracking-[-0.02em]">
              <span className="sr-only">¡Oído! </span>
              Elegiste a {primerNombre}
            </h1>
            <p id={bajadaId} className="mt-1.5 text-base font-medium">
              {detalle ? `${detalle} ` : ""}Ya le avisamos: falta que confirme.
            </p>

            <div className="mt-auto pt-6">
              <Link
                href={chatHref}
                className="boton boton-relieve flex min-h-[54px] items-center justify-center bg-primary px-5 py-3 text-base font-bold text-night"
              >
                Escribirle a {primerNombre}
              </Link>
              <Link
                href={panelHref}
                className="mt-1.5 flex min-h-12 items-center justify-center text-[length:var(--text-fila)] font-bold underline-offset-2 hover:underline"
              >
                Volver al panel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Una de las dos fotos: marco blanco, esquinas redondas, sombra. Sin foto (o
 *  si no carga), el cielo hondo con las iniciales. */
function Retrato({
  src,
  nombre,
  className,
  posicion,
  entero = false,
  sinIniciales = false,
}: {
  src: string | null;
  nombre: string;
  className: string;
  posicion: string;
  entero?: boolean;
  /** Sin nombre que abreviar: queda el cielo hondo solo. */
  sinIniciales?: boolean;
}) {
  const [rota, setRota] = useState(false);
  return (
    <span className={`oido-retrato absolute block h-[79.4%] w-[48%] overflow-hidden ${className}`}>
      {src && !rota ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto servida por Cloudinary, ya al ancho justo
        <img
          src={cldThumb(src, 400)}
          alt={nombre}
          onError={() => setRota(true)}
          draggable={false}
          className={`h-full w-full ${entero ? "bg-white object-contain p-3" : "object-cover"}`}
          style={entero ? undefined : { objectPosition: posicion }}
        />
      ) : (
        <span
          role="img"
          aria-label={nombre}
          className="cielo-hondo flex h-full w-full items-center justify-center text-[length:min(2.75rem,12vw)] font-extrabold tracking-[-0.02em]"
        >
          {sinIniciales ? null : iniciales(nombre)}
        </span>
      )}
    </span>
  );
}
