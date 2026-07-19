import Link from "next/link";
import { CandidateMatch } from "@/lib/types";
import { Avatar, Button, Rating } from "@/components/ui";

export default function CandidateCard({
  candidate,
  onAssign,
  disabled,
}: {
  candidate: CandidateMatch;
  onAssign: () => void;
  disabled?: boolean;
}) {
  return (
    // `.no-select`: tarjeta de chrome (score, rating, distancia) — mismo
    // criterio C0 #2 que ShiftCard (docs/PULIDO_ROADMAP.md fix 2).
    <div className="no-select relative overflow-hidden rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] ring-1 ring-line transition active:scale-[0.99]">
      <span className="absolute right-4 top-4 rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-ink/60">
        Score {candidate.score.toFixed(2)}
      </span>

      <div className="flex items-center gap-3 pr-20">
        <Link href={`/workers/${candidate.profile_id}`}>
          <Avatar src={candidate.photo_url} name={candidate.full_name} size="lg" />
        </Link>
        <div className="min-w-0">
          <Link
            href={`/workers/${candidate.profile_id}`}
            className="block truncate text-lg font-bold text-ink"
          >
            {candidate.full_name}
          </Link>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Rating value={candidate.rating} />
            {candidate.distance_km != null && (
              <span className="text-xs text-ink/40">· {candidate.distance_km.toFixed(1)} km</span>
            )}
          </div>
        </div>
      </div>

      <Button fullWidth className="mt-4" onClick={onAssign} loading={disabled} disabled={disabled}>
        Asignar
      </Button>
    </div>
  );
}
