"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { rotuloSemana, type DiaSemana } from "@/lib/semana";

/**
 * La semana del cielo, que se toca: siete días de lunes a domingo. Tocar uno
 * lo elige (la tecla blanca) y tocarlo otra vez lo suelta; hoy, sin elegir,
 * lleva un aro fino. Un punto marca los días con turnos. Las flechas cambian
 * de semana (con un puntito si del otro lado hay turnos) y, estando en otra,
 * «Volver a esta semana».
 *
 * Es una pieza compartida (Mis turnos y el Panel del comercio): no sabe qué
 * son los turnos ni filtra nada, sólo avisa qué se tocó. Quien la usa decide
 * qué hacer con el día elegido (y soltarlo al cambiar de semana). Se pinta
 * sobre un `.app-cielo` dentro de `.estilo-suave`.
 */
export interface SemanaTiraProps {
  /** Los siete días de la semana que se ve (`semanaArgentina`). */
  dias: DiaSemana[];
  /** Cuántos turnos hay por día (clave "YYYY-MM-DD"); sin entrada, ninguno. */
  turnosPorDia: ReadonlyMap<string, number>;
  /** La clave del día elegido, o `null` con la semana entera. */
  elegido: string | null;
  /** Se tocó un día: su clave para elegirlo, `null` si era el elegido. */
  onElegir: (clave: string | null) => void;
  /** Se tocó una flecha: -1 la semana anterior, 1 la siguiente. */
  onSemana: (paso: -1 | 1) => void;
  /** La semana que se ve es la de hoy (cambia el rótulo y esconde «Volver»). */
  esActual: boolean;
  /** Hay turnos en semanas anteriores / siguientes: un puntito en la flecha. */
  hayAntes?: boolean;
  hayDespues?: boolean;
  /** Estando en otra semana: «Volver a esta semana». Sin esto no se muestra. */
  onVolver?: () => void;
}

function nombreDia(d: DiaSemana, n: number): string {
  const turnos = n === 0 ? "" : `, ${n} ${n === 1 ? "turno" : "turnos"}`;
  return `${d.largo} ${d.numero}${d.esHoy ? ", hoy" : ""}${turnos}`;
}

export default function SemanaTira({
  dias,
  turnosPorDia,
  elegido,
  onElegir,
  onSemana,
  esActual,
  hayAntes = false,
  hayDespues = false,
  onVolver,
}: SemanaTiraProps) {
  return (
    <div data-testid="semana-tira" className="semana-tira md:max-w-md">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onSemana(-1)}
          className="flecha-vidrio relative"
          aria-label={hayAntes ? "Semana anterior, con turnos" : "Semana anterior"}
        >
          <ChevronLeftIcon size={16} />
          {hayAntes && <span aria-hidden data-punto="antes" className="flecha-punto" />}
        </button>
        {/* Las flechas quedan arriba: al aparecer «Volver», no se corren de debajo del dedo. */}
        <div className="flex min-w-0 flex-col items-center gap-1.5 pt-1.5 text-center">
          <p className="text-caption font-bold" aria-live="polite">
            {esActual ? "Esta semana" : "Semana"} · {rotuloSemana(dias)}
          </p>
          {!esActual && onVolver && (
            <button type="button" onClick={onVolver} className="chip-vidrio volver-semana">
              Volver a esta semana
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSemana(1)}
          className="flecha-vidrio relative"
          aria-label={hayDespues ? "Semana siguiente, con turnos" : "Semana siguiente"}
        >
          <ChevronRightIcon size={16} />
          {hayDespues && <span aria-hidden data-punto="despues" className="flecha-punto" />}
        </button>
      </div>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- sin viñetas, Safari le saca el rol de lista */}
      <ol role="list" aria-label="Días de la semana" className="mt-2 grid grid-cols-7 text-center">
        {dias.map((d) => {
          const n = turnosPorDia.get(d.clave) ?? 0;
          const es = elegido === d.clave;
          return (
            <li key={d.clave} data-dia={d.clave} className="flex flex-col items-center">
              <button
                type="button"
                aria-pressed={es}
                aria-label={nombreDia(d, n)}
                onClick={() => onElegir(es ? null : d.clave)}
                className="dia-boton"
              >
                <span aria-hidden className={`dia-nombre ${d.esHoy ? "font-bold" : "font-semibold"}`}>
                  {d.corto}
                </span>
                <span aria-hidden className={`dia-cielo ${es ? "dia-cielo-hoy" : d.esHoy ? "dia-cielo-aro" : ""}`}>
                  {d.numero}
                </span>
                <span aria-hidden data-con-turno={n > 0 ? "" : undefined} className={`dia-cielo-punto ${n > 0 ? "" : "opacity-0"}`} />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
