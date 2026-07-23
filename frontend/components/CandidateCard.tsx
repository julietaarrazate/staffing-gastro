import Link from "next/link";
import { CandidateMatch } from "@/lib/types";
import { Avatar, Button } from "@/components/ui";
import { BoltIcon } from "@/components/icons";
import {
  CandidateStatChips,
  RecommendationReasons,
} from "@/components/candidate/CandidateSignals";

/**
 * Tarjeta de candidato recomendado por el matching. El primero del ranking se
 * muestra `recommended`: destacado con el acento de marca y un "por qué te lo
 * recomendamos" (inspiración Clickie), en vez de un score numérico opaco. El
 * resto va en tarjeta sobria con los mismos chips de confianza.
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
    // que ShiftCard (docs/PULIDO_ROADMAP.md fix 2).
    <div
      className={`no-select overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-soft)] transition active:scale-[0.99] ${
        recommended ? "ring-2 ring-primary" : "ring-1 ring-line"
      }`}
    >
      {recommended && (
        <div className="flex items-center gap-1.5 bg-primary px-5 py-2 text-xs font-extrabold uppercase tracking-wide text-white">
          <BoltIcon size={14} /> Recomendado por Staffya
        </div>
      )}

      <div className="p-5">
        <div className="flex items-center gap-3">
          <Link href={`/workers/${candidate.profile_id}`}>
            <Avatar src={candidate.photo_url} name={candidate.full_name} size="lg" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/workers/${candidate.profile_id}`}
              className="block truncate text-lg font-bold text-ink"
            >
              {candidate.full_name}
            </Link>
            <CandidateStatChips signals={candidate} className="mt-1" />
          </div>
        </div>

        {recommended ? (
          <RecommendationReasons signals={candidate} />
        ) : null}

        <Button fullWidth className="mt-4" onClick={onAssign} loading={disabled} disabled={disabled}>
          Asignar
        </Button>
      </div>
    </div>
  );
}
