"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Applicant, CandidateMatch } from "@/lib/types";
import CandidateCard from "@/components/CandidateCard";
import { Avatar, Button, EmptyState, Rating, SegmentedControl, useToast } from "@/components/ui";
import { CardSkeletons, ErrorBanner } from "@/components/PageState";
import { UsersIcon } from "@/components/icons";

type Tab = "postulantes" | "recomendados";

export default function ShiftCandidatesPage() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const shiftId = params.id;
  const [tab, setTab] = useState<Tab>("postulantes");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [candidates, setCandidates] = useState<CandidateMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [apps, cands] = await Promise.all([
        api.get<Applicant[]>(`/applications/shifts/${shiftId}`, token).catch(() => []),
        api.get<CandidateMatch[]>(`/shifts/${shiftId}/candidates`, token).catch(() => []),
      ]);
      setApplicants(apps);
      setCandidates(cands);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar candidatos");
    } finally {
      setLoading(false);
    }
  }, [token, shiftId]);

  useEffect(() => {
    load();
  }, [load]);

  async function assign(profileId: string) {
    if (!token) return;
    setAssigning(profileId);
    try {
      await api.post(`/shifts/${shiftId}/assign`, { worker_profile_id: profileId }, token);
      toast("Turno asignado. El trabajador tiene que confirmar");
      router.push("/shifts");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "No se pudo asignar", "error");
      setAssigning(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Candidatos</h1>
      <p className="mt-0.5 text-sm text-zinc-500">
        Elegí a quién asignarle el turno. Los postulantes ya levantaron la mano.
      </p>

      <div className="mt-4">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: "postulantes", label: `Postulantes${applicants.length > 0 ? ` (${applicants.length})` : ""}` },
            { value: "recomendados", label: `Recomendados${candidates.length > 0 ? ` (${candidates.length})` : ""}` },
          ]}
        />
      </div>

      {loading && <CardSkeletons />}
      {error && <ErrorBanner message={error} />}

      {!loading && !error && tab === "postulantes" && (
        <div className="mt-5 grid gap-3">
          {applicants.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={28} />}
              title="Todavía nadie se postuló"
              subtitle="Cuando un trabajador deslice tu turno a la derecha, aparece acá. Mientras tanto, mirá los recomendados."
            />
          ) : (
            applicants.map((a) => (
              <div
                key={a.application_id}
                className="flex items-center gap-3 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-soft)] ring-1 ring-zinc-100"
              >
                <Link href={`/workers/${a.worker_profile_id}`}>
                  <Avatar src={a.photo_url} name={a.full_name} size="lg" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/workers/${a.worker_profile_id}`} className="block truncate font-semibold text-zinc-900">
                    {a.full_name}
                  </Link>
                  <Rating value={a.rating} />
                </div>
                <Button
                  size="sm"
                  onClick={() => assign(a.worker_profile_id)}
                  loading={assigning === a.worker_profile_id}
                  disabled={assigning !== null}
                >
                  Asignar
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {!loading && !error && tab === "recomendados" && (
        <div className="mt-5 grid gap-4">
          {candidates.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={28} />}
              title="Sin recomendados por ahora"
              subtitle="El sistema sigue buscando trabajadores disponibles para este turno en tiempo real."
            />
          ) : (
            candidates.map((candidate) => (
              <CandidateCard
                key={candidate.profile_id}
                candidate={candidate}
                disabled={assigning !== null}
                onAssign={() => assign(candidate.profile_id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
