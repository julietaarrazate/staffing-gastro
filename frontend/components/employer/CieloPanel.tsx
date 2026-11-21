import Link from "next/link";
import { NubesCielo } from "@/components/ui";
import { CalendarPlusIcon, PlusIcon } from "@/components/icons";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import { formatShiftStartPhrase } from "@/lib/datetime";
import type { ResumenPanel, TituloDelDia } from "@/lib/panel-comercio";
import { SKILL_LABELS, type Shift } from "@/lib/types";

/** «Cocinero/a, hoy a las 21:00»: de qué turno habla el cielo. */
function cualTurno(shift: Shift): string {
  return `${SKILL_LABELS[shift.position]}, ${formatShiftStartPhrase(shift.start_at)}`;
}

/**
 * El cielo del panel del comercio (ADR-0028, maquetas `C-Panel`,
 * `C-Panel-vacio` y `C-Panel-nadie`; compacto desde el 2026-11-21). Responde
 * «¿está cubierto?» y es bajo, para que el primer turno se vea sin bajar:
 *
 * - Una fila de estado: «Marchando» (a la izquierda, si algo busca personal)
 *   y «Evento», un chip chico de vidrio (a la derecha).
 * - El saludo y el número en UNA línea. El número cuenta los turnos del día
 *   que se mira en la tira (hoy, o el día elegido): «Hola, Julieta. Hoy tenés
 *   3 turnos», con «1 sin cubrir» al lado si alguno busca personal; sin
 *   turnos hoy, «Hoy no tenés turnos» y debajo el próximo.
 * - La acción pendiente en una fila: a la izquierda de qué turno se trata, a
 *   la derecha el ámbar «Elegir a quién va». Si nadie se postuló, sólo el
 *   texto («Todavía nadie cantó «oído»»).
 * - La tira de días (`tira`) abajo.
 *
 * Es el cielo hondo mientras hay turnos en curso y el de día si no. Un solo
 * ámbar: «Elegir a quién va»; **sin acción pendiente no hay «Publicar turno»
 * acá** (queda el «+» de la barra), salvo en el Panel vacío (`vacio`: ningún
 * turno todavía), donde es la acción de la pantalla. `titulo` en `null`:
 * todavía no se sabe (cargando, error o comercio sin perfil) y el cielo sólo
 * saluda.
 */
export default function CieloPanel({
  nombre,
  resumen,
  titulo,
  conAcciones,
  vacio = false,
  tira = null,
}: {
  nombre?: string;
  resumen: ResumenPanel | null;
  titulo: TituloDelDia | null;
  /** «Evento» (y «Publicar turno» en el Panel vacío): no van mientras carga ni sin perfil. */
  conAcciones: boolean;
  /** El primer día: ningún turno todavía. */
  vacio?: boolean;
  /** La semana que se toca (`SemanaTira`), debajo. */
  tira?: React.ReactNode;
}) {
  const hola = nombre ? `Hola, ${nombre}.` : "Hola.";
  const hondo = resumen?.enMarcha ?? false;
  const elegir = resumen?.elegir ?? null;
  const nadie = resumen?.nadie ?? null;
  const postulados = elegir?.pending_applicants_count ?? 0;

  const chipEvento = conAcciones ? (
    // El área de toque llega a 44 px aunque el chip sea chico.
    <Link href="/shifts/new-event" className="chip-vidrio relative shrink-0 before:absolute before:-inset-2 before:content-['']">
      <CalendarPlusIcon size={15} /> Evento
    </Link>
  ) : null;
  const filaDeEstado = (
    <div className="flex min-h-[32px] items-center justify-between gap-2">
      {resumen?.marchando ? (
        <span className="chip-vidrio gap-2">
          <span aria-hidden className="pulso-cielo" />
          Marchando
        </span>
      ) : (
        <span />
      )}
      {chipEvento}
    </div>
  );

  return (
    <div
      data-testid="panel-cielo"
      data-cielo={hondo ? "hondo" : "dia"}
      className={`cielo-de-pantalla panel-cielo app-cielo cielo-limpio px-5 pb-11 pt-4 md:rounded-t-[28px] md:px-6 md:pt-6 ${
        hondo ? "cielo-hondo" : ""
      }`}
    >
      {/* Una nube grande que asoma arriba, lejos de la letra: a la derecha en
          el celular y, en la compu (donde a la derecha va lo que se elige),
          entre las dos columnas. */}
      <NubesCielo
        nubes={[
          { forma: "a", ancho: 230, pos: { right: -64, top: -58 }, className: "md:hidden" },
          { forma: "a", ancho: 250, pos: { left: "30%", top: -74 }, className: "hidden md:block" },
        ]}
      />

      {/* En el celular no hay encabezado: «oído» y la campanita van acá, sobre
          el cielo. En la compu están en la barra de arriba. */}
      <div className="mb-3 flex items-center justify-between md:hidden">
        <Logo size={30} sobreCielo />
        <NotificationBell variante="vidrio" />
      </div>

      {vacio && conAcciones ? (
        <div className="md:max-w-md">
          {filaDeEstado}
          <p aria-hidden className="mt-3 break-words text-body font-semibold">
            {hola}
          </p>
          <h1
            className="mt-1 text-[min(2.25rem,9.5vw)] font-extrabold leading-none tracking-[-0.035em]"
            data-testid="panel-titulo"
          >
            <span className="sr-only">{hola} </span>
            ¿Te falta alguien hoy?
          </h1>
          <p className="mt-2 text-sm font-semibold">Pedilo como lo dirías en la cocina.</p>
          <Link
            href="/shifts/new"
            data-tour="shifts-publish"
            className="boton-relieve mt-4 flex min-h-[52px] items-center justify-center gap-1.5 bg-primary px-4 text-body font-bold text-night"
          >
            <PlusIcon size={18} /> Publicar turno
          </Link>
        </div>
      ) : !titulo || !resumen ? (
        <>
          {filaDeEstado}
          <h1 className="titulo-pantalla mt-3 break-words">{nombre ? `Hola, ${nombre}` : "Hola"}</h1>
        </>
      ) : (
        <div className="md:grid md:grid-cols-2 md:items-end md:gap-10">
          <div className="min-w-0">
            {filaDeEstado}
            <h1 className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5" data-testid="panel-titulo">
              <span className="min-w-0 break-words text-[min(1.375rem,5.6vw)] font-semibold leading-tight tracking-tight">
                {titulo.conSaludo ? `${hola} ` : ""}
                {titulo.antes}
                {titulo.destacado && (
                  <>
                    {" "}
                    <span className="font-extrabold">{titulo.destacado}</span>
                  </>
                )}
              </span>
              {titulo.sinCubrir > 0 && (
                <span className="chip-vidrio shrink-0 !px-2.5 !py-0.5 !text-caption font-bold" data-testid="panel-sin-cubrir">
                  {titulo.sinCubrir} sin cubrir
                </span>
              )}
            </h1>
            {titulo.proximo && (
              <p className="mt-1 text-sm font-semibold" data-testid="panel-proximo">
                {titulo.proximo}
              </p>
            )}
          </div>

          {(elegir || nadie) && (
            <div className="mt-3 min-w-0 md:mt-0">
              {elegir && (
                <div className="panel-vidrio flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="panel-elegir">
                  <div className="min-w-[min(100%,10rem)] flex-1">
                    <p className="break-words text-caption font-semibold leading-snug">{cualTurno(elegir)}</p>
                    <p className="text-body font-extrabold leading-snug tracking-tight">
                      {postulados === 1 ? "Ya se postuló 1" : `Ya se postularon ${postulados}`}
                    </p>
                  </div>
                  <Link
                    href={`/shifts/${elegir.id}/candidates`}
                    className="boton-relieve flex min-h-[44px] max-w-full shrink-0 items-center justify-center bg-primary px-4 text-center text-sm font-bold text-night"
                  >
                    Elegir a quién va
                  </Link>
                </div>
              )}
              {nadie && (
                <div className="panel-vidrio" data-testid="panel-nadie">
                  <p className="break-words text-caption font-semibold leading-snug">{cualTurno(nadie)}</p>
                  <p className="text-body font-extrabold leading-snug tracking-tight">Todavía nadie cantó «oído»</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {tira && <div className="mt-4">{tira}</div>}
    </div>
  );
}
