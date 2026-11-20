import Link from "next/link";
import { NubesCielo } from "@/components/ui";
import { CalendarPlusIcon, PlusIcon } from "@/components/icons";
import { formatShiftStartPhrase } from "@/lib/datetime";
import type { ResumenPanel } from "@/lib/panel-comercio";
import { SKILL_LABELS, type Shift } from "@/lib/types";

/** «Cocinero/a, hoy a las 21:00»: de qué turno habla el cielo. */
function cualTurno(shift: Shift): string {
  return `${SKILL_LABELS[shift.position]}, ${formatShiftStartPhrase(shift.start_at)}`;
}

/**
 * El cielo del panel del comercio (ADR-0028, maquetas `C-Panel`,
 * `C-Panel-vacio` y `C-Panel-nadie`). Responde «¿está cubierto?»:
 *
 * - Con turnos en curso es el **cielo hondo** (el servicio en marcha): el
 *   número de turnos de hoy y sus tres estados; si hay un turno con
 *   postulaciones, «Ya se postularon N» y el ámbar «Elegir a quién va»; si
 *   están buscando y no se postuló nadie, «Todavía nadie cantó «oído»».
 * - Sin nada en curso es el cielo de día, con «¿Te falta alguien hoy?».
 *
 * Un solo ámbar: «Elegir a quién va» cuando hay a quién elegir y, si no,
 * «Publicar turno» (que con el otro a la vista pasa a vidrio). `resumen` en
 * `null`: todavía no se sabe (cargando, error o comercio sin perfil) y el
 * cielo sólo saluda.
 */
export default function CieloPanel({
  nombre,
  resumen,
  conAcciones,
}: {
  nombre?: string;
  resumen: ResumenPanel | null;
  /** «Publicar turno» y «Evento»: no van mientras carga ni sin perfil. */
  conAcciones: boolean;
}) {
  const hola = nombre ? `Hola, ${nombre}.` : "Hola.";
  const hondo = resumen?.enMarcha ?? false;
  const elegir = resumen?.elegir ?? null;
  const nadie = resumen?.nadie ?? null;
  const postulados = elegir?.pending_applicants_count ?? 0;
  const frase = resumen?.deHoy ? "Hoy tenés" : "Tenés en curso";

  const acciones = conAcciones && (
    <div className="mt-4 flex gap-2">
      <Link
        href="/shifts/new"
        data-tour="shifts-publish"
        className={
          elegir
            ? "chip-vidrio boton-cielo flex-1"
            : "boton-relieve flex min-h-[52px] flex-1 items-center justify-center gap-1.5 bg-primary px-4 text-body font-bold text-night"
        }
      >
        <PlusIcon size={18} /> Publicar turno
      </Link>
      <Link href="/shifts/new-event" className="chip-vidrio boton-cielo">
        <CalendarPlusIcon size={17} /> Evento
      </Link>
    </div>
  );

  return (
    <div
      data-testid="panel-cielo"
      data-cielo={hondo ? "hondo" : "dia"}
      className={`panel-cielo app-cielo cielo-limpio px-5 pb-12 pt-5 md:rounded-t-[28px] md:px-6 md:pt-6 ${
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

      {!resumen ? (
        <>
          <h1 className="titulo-pantalla break-words">{nombre ? `Hola, ${nombre}` : "Hola"}</h1>
          {acciones}
        </>
      ) : hondo ? (
        <div className="md:grid md:grid-cols-2 md:items-end md:gap-10">
          <div className="min-w-0">
            {resumen.marchando && (
              <span className="chip-vidrio gap-2">
                <span aria-hidden className="pulso-cielo" />
                Marchando
              </span>
            )}
            <p aria-hidden className={`break-words text-body font-semibold ${resumen.marchando ? "mt-3" : ""}`}>
              {hola} {frase}
            </p>
            <h1 className="mt-1 flex items-baseline gap-2.5" data-testid="panel-titulo">
              <span className="sr-only">
                {hola} {frase}{" "}
              </span>
              <span className="numero-gigante">{resumen.total}</span>
              <span className="text-2xl font-extrabold tracking-tight">{resumen.total === 1 ? "turno" : "turnos"}</span>
            </h1>
            <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-2" data-testid="panel-estados">
              {(
                [
                  ["Buscando", resumen.buscando],
                  ["En marcha", resumen.cubiertos],
                  ["Terminados", resumen.terminados],
                ] as const
              ).map(([nombreEstado, cuantos]) => (
                <div key={nombreEstado} className="flex flex-col-reverse">
                  <dt className="mt-1 text-caption font-semibold">{nombreEstado}</dt>
                  <dd className="text-2xl font-extrabold leading-none tabular-nums">{cuantos}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-5 min-w-0 md:mt-0">
            {elegir && (
              <div className="panel-vidrio" data-testid="panel-elegir">
                <p className="break-words text-sm font-semibold">{cualTurno(elegir)}</p>
                <p className="mt-0.5 text-fila font-extrabold tracking-tight">
                  {postulados === 1 ? "Ya se postuló 1" : `Ya se postularon ${postulados}`}
                </p>
                <Link
                  href={`/shifts/${elegir.id}/candidates`}
                  className="boton-relieve mt-3 flex min-h-[52px] items-center justify-center bg-primary px-4 text-body font-bold text-night"
                >
                  Elegir a quién va
                </Link>
              </div>
            )}
            {nadie && (
              <div data-testid="panel-nadie">
                <p className="break-words text-sm font-semibold">{cualTurno(nadie)}</p>
                <p className="mt-0.5 text-fila font-extrabold tracking-tight">Todavía nadie cantó «oído»</p>
                <p className="mt-0.5 text-sm font-medium">Cuando alguien se postule, lo ves acá.</p>
              </div>
            )}
            {acciones}
          </div>
        </div>
      ) : (
        <div className="md:max-w-md">
          <p aria-hidden className="break-words text-body font-semibold">
            {hola}
          </p>
          <h1
            className="mt-2 text-[min(2.875rem,12vw)] font-extrabold leading-none tracking-[-0.035em]"
            data-testid="panel-titulo"
          >
            <span className="sr-only">{hola} </span>
            ¿Te falta alguien hoy?
          </h1>
          <p className="mt-3 text-sm font-semibold">Pedilo como lo dirías en la cocina.</p>
          {acciones}
        </div>
      )}
    </div>
  );
}
