"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { NubesCielo } from "@/components/ui";
import AIAssistantBar from "@/components/AIAssistantBar";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import type { InicioEstado, TurnoDeHoy } from "@/lib/inicio-estado";

/**
 * El cielo del Inicio de quien trabaja: saludo, título, zona y buscador. El
 * título dice la verdad según el estado (`decidirInicio`, lib/inicio-estado):
 * la hora del turno de hoy, cuánto falta para que empiece, hasta cuándo es,
 * «Hay turno a la vuelta», «Todo tranquilo por ahora»; y mientras no se sabe,
 * dos barras de esqueleto con un `h1` sólo para lectores («Inicio»), para que
 * la página nunca quede sin título.
 *
 * El `h1` es la frase grande y el saludo es aparte. Cuando el título es un
 * número gigante, el comienzo de la frase («Hoy trabajás a las») está en el
 * saludo, a la vista pero oculto a los lectores, y el `h1` lo repite en un
 * `span` sólo para ellos: se lee entero, «Hoy trabajás a las 20:00».
 *
 * Con algo en marcha (turno por empezar, empezado o en curso) el cielo es hondo
 * (`.cielo-hondo`).
 */

const TITULO = "text-[length:min(var(--text-titular),14.5vw)] font-extrabold leading-none tracking-[-0.035em]";
/** Alto de dos renglones del título, para que no haya salto al resolverse. */
const ALTO_TITULO = "min-h-[calc(2*min(var(--text-titular),14.5vw))]";

function PuestoEnLocal({ turno }: { turno: TurnoDeHoy }) {
  return <>{turno.local ? `${turno.puesto} en ${turno.local}` : turno.puesto}</>;
}

export default function CieloInicio({
  estado,
  firstName,
  available,
  onToggleAvailable,
  zona,
}: {
  estado: InicioEstado;
  firstName: string | undefined;
  available: boolean;
  onToggleAvailable: () => void;
  /** La zona (`LocationBar`) o, en una búsqueda del asistente, su renglón. */
  zona: ReactNode;
}) {
  const hondo = estado.tipo === "hoy-por-empezar" || estado.tipo === "hoy-en-curso" || estado.tipo === "hoy-empezo";
  const hola = firstName ? `Hola, ${firstName}.` : "Hola.";

  let saludo: ReactNode = hola;
  let titulo: ReactNode;
  let detalle: ReactNode = null;

  switch (estado.tipo) {
    case "hoy-mas-tarde": {
      const { turno } = estado;
      saludo = (
        <>
          {hola}
          <span aria-hidden> Hoy trabajás a las</span>
        </>
      );
      titulo = (
        <h1 className="numero-gigante mt-2" data-testid="inicio-titulo">
          <span className="sr-only">Hoy trabajás a las </span>
          {turno.horaInicio}
        </h1>
      );
      detalle = (
        <div className="mt-3" data-testid="inicio-turno">
          <p className="break-words text-puesto font-extrabold leading-tight tracking-[-0.01em]">
            <PuestoEnLocal turno={turno} />
          </p>
          {turno.lugar && <p className="mt-0.5 break-words text-sm font-medium">{turno.lugar}</p>}
        </div>
      );
      break;
    }
    case "hoy-por-empezar": {
      const { turno, minutos } = estado;
      saludo = (
        <>
          <PuestoEnLocal turno={turno} />.<span aria-hidden> Empezás en</span>
        </>
      );
      titulo = (
        <h1 className="numero-gigante mt-2" data-testid="inicio-titulo">
          <span className="sr-only">Empezás en </span>
          {minutos} min
        </h1>
      );
      break;
    }
    case "hoy-en-curso": {
      const { turno } = estado;
      const frase = turno.local ? `Estás en ${turno.local} hasta las` : "Tu turno termina a las";
      saludo = <span aria-hidden>{frase}</span>;
      titulo = (
        <h1 className="numero-gigante mt-2" data-testid="inicio-titulo">
          <span className="sr-only">{frase} </span>
          {turno.horaFin}
        </h1>
      );
      break;
    }
    case "hoy-empezo": {
      const { turno } = estado;
      const frase = turno.local ? `Tu turno en ${turno.local} empezó a las` : "Tu turno empezó a las";
      saludo = <span aria-hidden>{frase}</span>;
      titulo = (
        <h1 className="numero-gigante mt-2" data-testid="inicio-titulo">
          <span className="sr-only">{frase} </span>
          {turno.horaInicio}
        </h1>
      );
      break;
    }
    case "cargando":
      titulo = (
        <>
          <h1 className="sr-only">Inicio</h1>
          {/* Dos barras con el alto de dos renglones del título. */}
          <div
            aria-hidden
            data-testid="inicio-titulo-esqueleto"
            className={`mt-2 flex flex-col justify-between ${ALTO_TITULO}`}
          >
            <div className="h-[40px] w-[78%] animate-pulse rounded-full bg-[rgba(255,255,255,0.35)] motion-reduce:animate-none" />
            <div className="h-[40px] w-[56%] animate-pulse rounded-full bg-[rgba(255,255,255,0.35)] motion-reduce:animate-none" />
          </div>
        </>
      );
      break;
    case "tranquilo":
      titulo = (
        <h1
          className={`mt-2 text-[length:min(var(--text-titular),11.8vw)] font-extrabold leading-none tracking-[-0.035em] ${ALTO_TITULO}`}
          data-testid="inicio-titulo"
        >
          Todo tranquilo{" "}
          <br />
          por ahora
        </h1>
      );
      break;
    case "con-error":
      titulo = (
        <h1 className={`mt-2 ${TITULO} ${ALTO_TITULO}`} data-testid="inicio-titulo">
          Inicio
        </h1>
      );
      break;
    case "con-turnos":
      titulo = (
        <h1 className={`mt-2 ${TITULO} ${ALTO_TITULO}`} data-testid="inicio-titulo">
          Hay turno{" "}
          <br />a la vuelta
        </h1>
      );
      break;
  }

  return (
    <div
      data-testid="inicio-cielo"
      data-estado={estado.tipo}
      className={`cielo-de-pantalla app-cielo cielo-limpio${hondo ? " cielo-hondo" : ""} px-4 pb-11 pt-4 md:rounded-t-[28px] md:px-6 md:pb-12 md:pt-6`}
    >
      {/* Una nube grande que asoma arriba a la derecha y una chica «de lejos»
          a la derecha del título (se oculta por debajo de 360 px: `max-[360px]`
          es «menos de 360»). De día una nube puede quedar detrás de un texto
          en tinta; no puede tapar nada ni ir detrás de letra blanca (de noche
          no hay; en el cielo hondo van al 30 %). */}
      <NubesCielo
        nubes={[
          // En el cielo hondo la grande asoma apenas por arriba (su borde de
          // abajo queda por encima del chip «Disponible»): detrás del chip y
          // de la letra blanca la nube les quita contraste.
          {
            forma: "a",
            ancho: "min(300px, 68vw)",
            pos: { right: "calc(min(300px, 68vw) * -0.28)", top: hondo ? "calc(min(300px, 68vw) * -0.6)" : -64 },
          },
          // La chica «de lejos» queda detrás de la hora gigante: en el cielo
          // hondo (letra blanca) no va.
          ...(hondo
            ? []
            : [{ forma: "b" as const, ancho: 100, pos: { right: 24, top: 92 }, lejos: true, className: "max-[360px]:hidden" }]),
        ]}
      />
      {/* El saludo ocupa lo que deja el chip y se parte entre palabras; si una
          sola palabra no entra al lado (un nombre largo a 320 px), el chip
          baja a su renglón. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* En el celular no hay encabezado: «oído» va acá, sobre el cielo, y
            el saludo baja a su renglón. En la compu la marca está en la barra
            de arriba. */}
        <span className="md:hidden">
          <Logo size={30} sobreCielo />
        </span>
        <p className="hidden min-w-min flex-1 break-words text-base font-semibold md:block">{saludo}</p>
        {/* «Disponible»: un chip de vidrio con un punto verde cuando está
            prendido y gris cuando no. Mismo estado y mismo guardado de siempre. */}
        <button
          type="button"
          onClick={onToggleAvailable}
          className="chip-vidrio chip-disponible ml-auto min-h-11 shrink-0 px-3.5 text-sm"
          aria-label={`${available ? "Disponible" : "No disponible"}: cambiar disponibilidad`}
          aria-pressed={available}
        >
          <span aria-hidden className={`h-2 w-2 rounded-full ${available ? "bg-success" : "bg-ink-soft"}`} />
          {available ? "Disponible" : "No disponible"}
        </button>
        <span className="md:hidden">
          <NotificationBell variante="vidrio" />
        </span>
      </div>
      <p className="mt-5 break-words text-base font-semibold md:hidden">{saludo}</p>
      {titulo}
      {detalle}
      {/* El único ámbar de la pantalla: las acciones del turno viven en Mis
          turnos, acá sólo se va para allá. */}
      {(estado.tipo === "hoy-mas-tarde" || estado.tipo === "hoy-por-empezar" || estado.tipo === "hoy-en-curso" || estado.tipo === "hoy-empezo") && (
        <Link
          href="/my-shifts"
          data-testid="inicio-ver-turno"
          className="boton-relieve mt-4 flex min-h-[48px] w-full items-center justify-center bg-primary px-4 text-body font-bold text-night"
        >
          Ver mi turno
        </Link>
      )}
      {/* Desde dónde se mide el feed, debajo del título y a todo el ancho. */}
      <div className="mb-4 mt-3">{zona}</div>

      <AIAssistantBar vidrio />
    </div>
  );
}
