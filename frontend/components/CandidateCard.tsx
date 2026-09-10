import Link from "next/link";
import { CandidateMatch } from "@/lib/types";
import { Avatar, Button } from "@/components/ui";
import IdentityVerifiedBadge from "@/components/IdentityVerifiedBadge";
import { BoltIcon } from "@/components/icons";
import {
  CandidateStatChips,
  RecommendationReasons,
} from "@/components/candidate/CandidateSignals";

/**
 * Tarjeta de candidato recomendado por el matching. El primero del ranking se
 * muestra `recommended`, con un "por qué te lo recomendamos" (inspiración
 * Clickie) en vez de un score numérico opaco. El resto va en tarjeta sobria
 * con los mismos chips de confianza.
 *
 * EL RECOMENDADO VA EN NEGRO, no en ámbar (auditoría de distribución de
 * superficies, 2026-09-10). Antes se destacaba con `ring-2 ring-primary` MÁS
 * una banda ámbar sólida a todo el ancho, y abajo un "Asignar" ámbar — tres
 * ámbares en la misma tarjeta. Peor: las otras dos tarjetas tenían el MISMO
 * "Asignar" ámbar, que es el elemento más fuerte de cada una, así que el
 * recomendado no ganaba nada. Medido en un render a 390px: siete elementos
 * ámbar en la pantalla, con el ámbar diciendo al mismo tiempo "éste es el
 * recomendado" y "tocá acá" — dos significados en un solo color, así que no
 * se leía ninguno.
 *
 * El negro sí distingue, y distingue con trabajo semántico: dice "éste". Es
 * el tratamiento que prescribe el mockup aprobado
 * (`docs/design/mockups/09-hibrido-app.html`, `.rankcard.top`) y el mismo
 * "módulo de foco" que ya usan `/turno/[id]` (el pago) y el perfil del
 * trabajador (las ganancias). Funciona porque es SINGULAR por construcción
 * —sólo `i === 0` lo recibe—: tres bloques negros seguidos serían rayas, uno
 * solo sobre crema es foco.
 *
 * Y libera el ámbar para lo único que debería significar acá: la acción. El
 * "Asignar" del recomendado queda sólido (ámbar sobre negro, máximo
 * contraste) y el de los demás pasa a secundario — siguen disponibles, pero
 * la pantalla ahora tiene UNA acción primaria en vez de tres empatadas.
 * Adentro del negro el contenido va con color (COLOR_SYSTEM §3.2): chip
 * ámbar, nombre en blanco, motivos en crema.
 */
export default function CandidateCard({
  candidate,
  onAssign,
  disabled,
  recommended = false,
}: {
  candidate: CandidateMatch;
  onAssign: () => void;
  disabled?: boolean;
  recommended?: boolean;
}) {
  return (
    // `.no-select`: tarjeta de chrome (rating, chips) — mismo criterio C0 #2
    // que ShiftCard (docs/planning/PULIDO_ROADMAP.md fix 2).
    <div
      className={`no-select overflow-hidden rounded-[var(--radius-card)] transition active:scale-[0.99] ${
        recommended
          ? "bg-night shadow-[var(--shadow-float)]"
          : "bg-card shadow-[var(--shadow-soft)] ring-1 ring-line"
      }`}
    >
      {recommended && (
        <div className="flex items-center gap-2 px-5 pt-5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary text-night">
            <BoltIcon size={14} />
          </span>
          <span className="text-xs font-extrabold font-mono uppercase tracking-wide text-primary">
            Recomendado por Oído
          </span>
        </div>
      )}

      <div className={recommended ? "px-5 pb-5 pt-4" : "p-5"}>
        <div className="flex items-center gap-3">
          <Link href={`/workers/${candidate.profile_id}`}>
            <Avatar src={candidate.photo_url} name={candidate.full_name} size="lg" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/workers/${candidate.profile_id}`}
              className={`block truncate text-lg font-bold ${recommended ? "text-white" : "text-ink"}`}
            >
              {candidate.full_name}
            </Link>
            {candidate.identidad_verificada && (
              <IdentityVerifiedBadge verified className="mt-1" />
            )}
            <CandidateStatChips signals={candidate} className="mt-1" onDark={recommended} />
          </div>
        </div>

        {recommended ? <RecommendationReasons signals={candidate} onDark /> : null}

        <Button
          fullWidth
          className="mt-4"
          variant={recommended ? "primary" : "surface"}
          onClick={onAssign}
          loading={disabled}
          disabled={disabled}
        >
          Asignar
        </Button>
      </div>
    </div>
  );
}
