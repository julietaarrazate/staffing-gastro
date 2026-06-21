"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CandidateMatch } from "@/lib/types";
import CandidateCard from "@/components/CandidateCard";

export default function ShiftCandidatesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const shiftId = params.id;
  const [candidates, setCandidates] = useState<CandidateMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .get<CandidateMatch[]>(`/shifts/${shiftId}/candidates`, token)
      .then(setCandidates)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Error al cargar candidatos")
      )
      .finally(() => setLoading(false));
  }, [token, shiftId]);

  async function assign(profileId: string) {
    if (!token) return;
    setAssigning(profileId);
    setError(null);
    try {
      await api.post(`/shifts/${shiftId}/assign`, { worker_profile_id: profileId }, token);
      router.push("/shifts");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo asignar el turno");
    } finally {
      setAssigning(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Candidatos</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Estos son los trabajadores recomendados para este turno, ordenados por afinidad.
      </p>

      {loading && <p className="mt-8 text-zinc-500">Cargando candidatos...</p>}
      {error && <p className="mt-8 text-red-600">{error}</p>}
      {!loading && candidates.length === 0 && !error && (
        <p className="mt-8 text-zinc-500">No hay candidatos disponibles para este turno todavía.</p>
      )}

      <div className="mt-6 grid gap-4">
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.profile_id}
            candidate={candidate}
            disabled={assigning === candidate.profile_id}
            onAssign={() => assign(candidate.profile_id)}
          />
        ))}
      </div>
    </div>
  );
}
