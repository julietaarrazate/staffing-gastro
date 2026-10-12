"use client";

import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { IosShareIcon, MoreVerticalIcon, SmartphoneIcon, SquarePlusIcon } from "@/components/icons";
import { useInstalar, type EstadoInstalar } from "@/lib/instalar";
import { PhoneFrame, PushNotice } from "./replicas";
import Reveal from "./Reveal";

// backend/app/modules/application/application/services.py (aviso de postulante)
const PUSH_POSTULANTES = {
  title: "3 postulantes para Mozo/a",
  body: "Camila P. se postuló a tu turno de Mozo/a. Entrá para ver a todos los postulantes y elegir.",
};

/**
 * Instalar Oído en el celular (Julieta, 2026-10-12: "que quien entre por
 * primera vez se la descargue", en Android y en iPhone, sin tecnicismos).
 * Siempre los dos caminos, nombrando el navegador ("desde Chrome", "desde
 * Safari") para que se entienda que se baja desde ahí; primero el del
 * aparato que mira. En Android, si el navegador lo ofrece, un botón instala
 * directo. Ya instalada, la sección no aparece. Va al final, antes del
 * cierre, para no cortar lo que cuenta la página.
 *
 * Los avisos no se piden acá: la app los ofrece después de la primera
 * acción que importa (publicar, postularse), ver lib/push-prompt-context.tsx.
 */
export default function InstalarApp() {
  const estado = useInstalar();
  if (estado.instalada) return null;

  return (
    <section
      id="instalar"
      aria-labelledby="instalar-titulo"
      data-tone="light"
      className="scroll-mt-[var(--lht)] px-4 py-20 sm:px-6 lg:grid lg:grid-cols-12 lg:items-center lg:gap-12 lg:px-12 lg:py-28"
    >
      <div className="lg:col-span-7">
        <h2
          id="instalar-titulo"
          className="font-display text-poster font-semibold tracking-[-0.015em] text-ink [text-wrap:balance]"
        >
          Llevá Oído en tu celular
        </h2>
        <div className="mt-9">
          <Pasos estado={estado} />
        </div>
        <p className="mt-8 max-w-[44ch] text-caption text-ink-soft">
          Cuando publiques tu primer turno o te postules a uno, tocá &ldquo;Activar&rdquo; para que te lleguen los
          avisos.
        </p>
      </div>

      <Reveal className="mt-14 hidden justify-center lg:col-span-5 lg:mt-0 lg:flex" delay={120}>
        <div inert aria-hidden className="no-select">
          <PhoneFrame hora="20:51">
            <div className="relative h-[504px] px-4 pt-3">
              <PushNotice className="anim-drop" title={PUSH_POSTULANTES.title} body={PUSH_POSTULANTES.body} />
              <div className="mt-8 grid grid-cols-4 gap-x-3 gap-y-5">
                {Array.from({ length: 11 }, (_, i) => (
                  <span key={i} className="aspect-square rounded-[14px] bg-ink/[0.07]" />
                ))}
                <span className="anim-pop flex flex-col items-center gap-1" style={{ ["--d" as string]: "500ms" }}>
                  <LogoMark size={46} />
                  <span className="text-label font-semibold text-ink">Oído</span>
                </span>
              </div>
            </div>
          </PhoneFrame>
        </div>
      </Reveal>
    </section>
  );
}

function Pasos({ estado }: { estado: EstadoInstalar }) {
  const { plataforma, puedeInstalarDirecto, instalar } = estado;

  // Se instala desde el navegador: cada columna lo nombra (Chrome, Safari)
  // para que se entienda sin explicar qué es una web app.
  const android = (
    <ListaPasos
      titulo="Android · desde Chrome"
      pasos={
        puedeInstalarDirecto
          ? [
              <button
                key="boton"
                type="button"
                data-cta="instalar"
                onClick={() => void instalar()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-btn)] bg-night px-6 text-base font-semibold text-white transition duration-200 active:scale-[0.96] hover:brightness-150"
              >
                <SmartphoneIcon size={18} aria-hidden />
                Instalar Oído
              </button>,
              <>Abrí Oído desde el ícono nuevo</>,
            ]
          : [
              <>
                Tocá <Icono><MoreVerticalIcon size={16} /></Icono> arriba a la derecha
              </>,
              <>
                Elegí <strong className="font-semibold">Instalar app</strong> o{" "}
                <strong className="font-semibold">Agregar a la pantalla principal</strong>
              </>,
              <>Abrí Oído desde el ícono nuevo</>,
            ]
      }
    />
  );
  const iphone = (
    <ListaPasos
      titulo="iPhone · desde Safari"
      pasos={[
        <>
          Tocá <Icono><IosShareIcon size={16} /></Icono> <strong className="font-semibold">Compartir</strong>, abajo
        </>,
        <>
          Elegí <Icono><SquarePlusIcon size={16} /></Icono> <strong className="font-semibold">Agregar a inicio</strong>
        </>,
        <>Abrí Oído desde el ícono nuevo</>,
      ]}
    />
  );

  // Los dos siempre a la vista; primero el del aparato que está mirando.
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {plataforma === "iphone" ? (
        <>
          {iphone}
          {android}
        </>
      ) : (
        <>
          {android}
          {iphone}
        </>
      )}
      {plataforma === "compu" && (
        <p className="flex items-start gap-3 text-body text-ink-soft sm:col-span-2">
          <SmartphoneIcon size={20} aria-hidden className="mt-0.5 shrink-0 text-primary-text" />
          Entrá a oido.com.ar desde el celular y seguí estos pasos.
        </p>
      )}
    </div>
  );
}

function ListaPasos({ titulo, pasos }: { titulo: string; pasos: ReactNode[] }) {
  return (
    <div>
      <h3 className="font-mono text-caption font-medium uppercase tracking-[0.12em] text-primary-text">{titulo}</h3>
      <ol className="mt-4 grid gap-3">
        {pasos.map((p, i) => (
          <li key={i} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-card p-4 text-body text-ink ring-1 ring-line lg:text-lg">
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full bg-night font-mono text-caption font-medium text-white"
            >
              {i + 1}
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** El ícono tal como se ve en el teléfono, dentro de la frase. */
function Icono({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="mx-0.5 inline-grid size-7 translate-y-[0.35em] place-items-center rounded-lg bg-surface text-primary-text ring-1 ring-line"
    >
      {children}
    </span>
  );
}
