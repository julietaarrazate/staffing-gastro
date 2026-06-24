import Link from "next/link";
import { CandidateMatch } from "@/lib/types";
import { StarIcon } from "@/components/icons";

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
    <div className="relative overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 transition active:scale-[0.99] hover:shadow-lg">
      <span className="absolute right-0 top-0 rounded-bl-2xl bg-gradient-to-br from-orange-500 to-red-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
        Score {candidate.score.toFixed(2)}
      </span>

      <div className="flex items-center gap-3 pr-16">
        {candidate.photo_url ? (
          <img
            src={candidate.photo_url}
            alt={candidate.full_name}
            className="h-14 w-14 rounded-full object-cover ring-2 ring-orange-100"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-xl font-bold text-orange-700 ring-2 ring-orange-100">
            {candidate.full_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <Link
            href={`/workers/${candidate.profile_id}`}
            className="text-lg font-bold text-zinc-900 hover:text-orange-600"
          >
            {candidate.full_name}
          </Link>
          <p className="inline-flex items-center gap-1 text-sm text-zinc-500">
            <StarIcon size={14} filled className="text-amber-400" />
            {candidate.rating.toFixed(1)} ·{" "}
            {candidate.distance_km != null
              ? `${candidate.distance_km.toFixed(1)} km de distancia`
              : "Distancia desconocida"}
          </p>
        </div>
      </div>

      <button
        onClick={onAssign}
        disabled={disabled}
        className="mt-4 w-full rounded-full bg-orange-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
      >
        {disabled ? "Asignando..." : "Asignar"}
      </button>
    </div>
  );
}
