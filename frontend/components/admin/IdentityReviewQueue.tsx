"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import {
  BUSINESS_CLAIM_TYPE,
  EVIDENCE_LABELS,
  evidenceLinkPath,
  isDocumentEvidence,
  isLinkStale,
  type EvidenceLink,
  type PendingClaim,
  type PendingEvidence,
} from "@/lib/identity";
import { Avatar, Button, Card, EmptyState, ErrorBanner, Skeleton, TextField } from "@/components/ui";
import { FileTextIcon, ShieldIcon } from "@/components/icons";
import { safeHttpsUrl } from "@/lib/safe-url";

/**
 * Una evidencia en la cola. La constancia de AFIP suele ser un **PDF**, y un
 * PDF renderizado con `<img>` da una imagen rota — que es exactamente lo que
 * pasaba antes del ADR-0013, cuando esta cola asumía que toda evidencia era
 * una foto de DNI. Un documento se muestra como documento.
 *
 * Desde el ADR-0021 el archivo es privado: la cola no trae URLs, y cada
 * evidencia pide su propio link, que vence a los 5 minutos. Si el admin la
 * abre después de eso, se pide uno nuevo en el momento.
 */
function EvidenceThumb({ evidence }: { evidence: PendingEvidence }) {
  const { token } = useAuth();
  const [link, setLink] = useState<EvidenceLink | null>(null);
  const [failed, setFailed] = useState(false);
  const label = EVIDENCE_LABELS[evidence.evidence_type] ?? evidence.evidence_type;
  const isDocument = isDocumentEvidence(evidence.evidence_type);

  const fetchLink = useCallback(async (): Promise<EvidenceLink | null> => {
    if (!token) return null;
    try {
      const fresh = await api.get<EvidenceLink>(evidenceLinkPath(evidence.evidence_id), token);
      setLink(fresh);
      setFailed(false);
      return fresh;
    } catch {
      setFailed(true);
      return null;
    }
  }, [token, evidence.evidence_id]);

  useEffect(() => {
    if (evidence.available) void fetchLink();
  }, [evidence.available, fetchLink]);

  async function openFresh(e: React.MouseEvent<HTMLAnchorElement>) {
    if (link && !isLinkStale(link)) return; // el link sigue vigente: abre solo
    e.preventDefault();
    // La pestaña se abre YA (dentro del clic) para que el navegador no la
    // bloquee como popup, y se le carga la URL cuando llega el link nuevo.
    const tab = window.open("", "_blank");
    const fresh = await fetchLink();
    const href = safeHttpsUrl(fresh?.url);
    if (tab && href) {
      tab.opener = null;
      tab.location.href = href;
    } else {
      tab?.close();
    }
  }

  const tile = "aspect-[3/2] w-32 rounded-xl ring-1 ring-line";
  const caption = <span className="mt-1 block text-center text-label text-ink/50">{label}</span>;

  if (!evidence.available || failed) {
    return (
      <div>
        <span
          className={`${tile} flex flex-col items-center justify-center gap-1 bg-surface px-2 text-center text-ink/60`}
        >
          <FileTextIcon size={20} />
          <span className="text-label font-semibold">
            {evidence.available ? "No se pudo abrir" : "Sin archivo"}
          </span>
          {failed && (
            <button
              type="button"
              onClick={() => void fetchLink()}
              className="text-label font-semibold text-primary underline"
            >
              Reintentar
            </button>
          )}
        </span>
        {caption}
      </div>
    );
  }

  const href = safeHttpsUrl(link?.url);
  if (!href) {
    return (
      <div aria-busy="true">
        <Skeleton className={`${tile}`} />
        {caption}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group"
      title={`Ver ${label} en tamaño completo`}
      onClick={openFresh}
    >
      {isDocument ? (
        <span
          className={`${tile} flex flex-col items-center justify-center gap-1 bg-surface text-ink/60 transition group-hover:ring-primary`}
        >
          <FileTextIcon size={22} />
          <span className="text-label font-semibold">Abrir documento</span>
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={href}
          alt={label}
          className={`${tile} object-cover transition group-hover:ring-primary`}
        />
      )}
      {caption}
    </a>
  );
}

function isBusiness(claim: PendingClaim): boolean {
  return claim.claim_type === BUSINESS_CLAIM_TYPE;
}

function ReviewCardSkeleton() {
  return (
    <Card className="p-5" aria-hidden>
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
          subtitle="Cuando un trabajador envíe su DNI o un comercio su constancia de AFIP, aparece acá."
        />
      </div>
    );
  }

  return (
    <div className="mt-2 grid gap-3 md:grid-cols-2">
      {claims.map((claim) => (
        <Card key={claim.claim_id} className="p-5">
          <div className="flex items-center gap-3">
            <Avatar
              name={
                (isBusiness(claim) ? claim.company_name : claim.full_name) ?? "?"
              }
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">
                {isBusiness(claim)
                  ? (claim.company_name ?? "Comercio")
                  : (claim.full_name ?? "Trabajador")}
              </p>
              <p className="truncate text-xs text-ink/50">
                {isBusiness(claim)
                  ? // El nombre del titular, porque la comprobación que hace
                    // revisable una constancia es que la razón social del PDF
                    // se corresponda con el comercio que la mandó.
                    `Constancia de AFIP · ${claim.full_name ?? "titular sin nombre"}`
                  : "Documento + selfie"}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {claim.evidences.map((ev) => (
              <EvidenceThumb key={ev.evidence_id} evidence={ev} />
            ))}
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
