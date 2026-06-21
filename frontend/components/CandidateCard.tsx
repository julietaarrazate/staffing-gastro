import { CandidateMatch } from "@/lib/types";

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
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {candidate.photo_url ? (
            <img
              src={candidate.photo_url}
              alt={candidate.full_name}
              className="h-12 w-12 rounded-full object-cover ring-1 ring-zinc-100"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">
              {candidate.full_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="text-lg font-bold text-zinc-900">{candidate.full_name}</h3>
            <p className="text-sm text-zinc-500">
              ⭐ {candidate.rating.toFixed(1)} ·{" "}
              {candidate.distance_km != null
                ? `${candidate.distance_km.toFixed(1)} km de distancia`
                : "Distancia desconocida"}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
          Score {candidate.score.toFixed(2)}
        </span>
      </div>

      <button
        onClick={onAssign}
        disabled={disabled}
        className="mt-4 rounded-full bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {disabled ? "Asignando..." : "Asignar"}
      </button>
    </div>
  );
}
