"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { EVIDENCE_LABELS, type PendingClaim } from "@/lib/identity";
import { Avatar, Button, Card, EmptyState, ErrorBanner, Skeleton, TextField } from "@/components/ui";
import { ShieldIcon } from "@/components/icons";

function ReviewCardSkeleton() {
  return (
    <Card className="p-4" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="aspect-[3/2] w-32 rounded-xl" />
        <Skeleton className="aspect-[3/2] w-32 rounded-xl" />
      </div>
    </Card>
  );
}

export default function IdentityReviewQueue() {
  const { token } = useAuth();
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Claim en modo "rechazo" (muestra el motivo) → id del claim, y el texto.
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    if (!token) return;
    setError(null);
    api
      .get<PendingClaim[]>("/identity/claims/pending", token)
      .then(setClaims)
      .catch((err) => setError(getErrorMessage(err, "No se pudo cargar la cola")))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(claimId: string, action: "approve" | "reject") {
    if (!token) return;
    setBusy(`${claimId}:${action}`);
    try {
      await api.post(
        `/identity/claims/${claimId}/${action}`,
        action === "reject" ? { reason: reason.trim() || null } : undefined,
        token
      );
      setRejecting(null);
      setReason("");
      // Optimista: sacamos el claim resuelto de la cola sin recargar todo.
      setClaims((prev) => prev.filter((c) => c.claim_id !== claimId));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo completar la revisión"));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <ReviewCardSkeleton />
        <ReviewCardSkeleton />
      </div>
    );
  }

  if (error) return <ErrorBanner message={error} onRetry={load} />;

  if (claims.length === 0) {
    return (
      <div className="mt-2">
        <EmptyState
          icon={<ShieldIcon size={24} />}
          title="No hay identidades por revisar"
          subtitle="Cuando un trabajador envíe su DNI, aparece acá."
        />
      </div>
    );
  }

  return (
    <div className="mt-2 grid gap-3 md:grid-cols-2">
      {claims.map((claim) => (
        <Card key={claim.claim_id} className="p-4">
          <div className="flex items-center gap-3">
            <Avatar name={claim.full_name ?? "?"} size="md" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">
                {claim.full_name ?? "Trabajador"}
              </p>
              <p className="text-xs text-ink/50">Documento + selfie</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {claim.evidences.map((ev) =>
              ev.data_url ? (
                <a
                  key={ev.evidence_type}
                  href={ev.data_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                  title={`Ver ${EVIDENCE_LABELS[ev.evidence_type] ?? ev.evidence_type} en tamaño completo`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ev.data_url}
                    alt={EVIDENCE_LABELS[ev.evidence_type] ?? ev.evidence_type}
                    className="aspect-[3/2] w-32 rounded-xl object-cover ring-1 ring-line transition group-hover:ring-primary"
                  />
                  <span className="mt-1 block text-center text-[11px] text-ink/50">
                    {EVIDENCE_LABELS[ev.evidence_type] ?? ev.evidence_type}
                  </span>
                </a>
              ) : null
            )}
          </div>

          {rejecting === claim.claim_id ? (
            <div className="mt-3">
              <TextField
                label="Motivo del rechazo (opcional)"
                value={reason}
                onChange={setReason}
                placeholder="Ej: DNI ilegible"
              />
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  loading={busy === `${claim.claim_id}:reject`}
                  onClick={() => decide(claim.claim_id, "reject")}
                >
                  Confirmar rechazo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRejecting(null);
                    setReason("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy !== null}
                loading={busy === `${claim.claim_id}:approve`}
                onClick={() => decide(claim.claim_id, "approve")}
              >
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="surface"
                disabled={busy !== null}
                onClick={() => {
                  setRejecting(claim.claim_id);
                  setReason("");
                }}
              >
                Rechazar
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
