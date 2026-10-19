"use client";

import type { ReactNode } from "react";
import { IosShareIcon, MoreVerticalIcon, SmartphoneIcon, SquarePlusIcon } from "@/components/icons";
import { useInstalar, type EstadoInstalar } from "@/lib/instalar";

/**
 * Cómo instalar Oído en el celular, para la pregunta frecuente "¿Cómo la bajo
 * al celular?" (hasta el 2026-10-13 era una sección propia; Julieta la pasó a
 * las preguntas para no cortar la página). Siempre los dos caminos,
 * nombrando el navegador ("desde Chrome", "desde Safari"), primero el del
 * aparato que mira; en Android, si el navegador lo ofrece, un botón instala
 * directo. Ya instalada, dice eso. Los avisos no se piden acá: la app los
 * ofrece después de la primera acción que importa (lib/push-prompt-context.tsx).
 */
export default function InstalarPasos() {
  const estado = useInstalar();
  if (estado.instalada) {
    return <p className="pb-5 text-body text-ink-soft lg:text-lg">Ya tenés Oído instalada en este aparato.</p>;
  }
  return (
    <div className="pb-6">
      <Pasos estado={estado} />
    </div>
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
