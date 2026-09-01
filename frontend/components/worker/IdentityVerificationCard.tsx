"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { uploadImage } from "@/lib/cloudinary";
import { getErrorMessage } from "@/lib/errors";
import {
  documentClaim,
  type IdentitySummary,
} from "@/lib/identity";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import IdentityVerifiedBadge from "@/components/IdentityVerifiedBadge";
import { CameraIcon, CheckCircleIcon, ShieldIcon } from "@/components/icons";

/** Un casillero para subir una imagen (DNI o selfie). Sube a Cloudinary y
 * expone la URL resultante; no recorta (un DNI no es un avatar). */
function DocSlot({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo subir la imagen"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={value ? `Cambiar ${label}` : `Subir ${label}`}
        className="relative flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-2xl bg-surface text-ink/50 ring-1 ring-line transition active:scale-[0.98] disabled:opacity-70"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs font-semibold">
            <CameraIcon size={22} />
            {label}
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Spinner size={22} className="text-white" />
          </span>
        )}
        {value && !uploading && (
          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-success text-white">
            <CheckCircleIcon size={14} />
          </span>
        )}
      </button>
      <p className="mt-1 text-center text-[11px] text-ink/45">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {error && <p className="mt-1 text-center text-xs text-danger">{error}</p>}
    </div>
  );
}

export default function IdentityVerificationCard() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<IdentitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Formulario de envío (visible cuando corresponde subir/reenviar).
  const [dniFront, setDniFront] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoadError(false);
    try {
      setSummary(await api.get<IdentitySummary>("/identity/me", token));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit() {
    if (!token || !dniFront || !selfie) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const updated = await api.post<IdentitySummary>(
        "/identity/me/document",
        { dni_frente_url: dniFront, selfie_url: selfie },
        token
      );
      setSummary(updated);
      setDniFront(null);
      setSelfie(null);
    } catch (err) {
      setSubmitError(getErrorMessage(err, "No se pudo enviar la verificación"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size={22} className="text-ink/40" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-ink/60">No se pudo cargar tu estado de identidad.</p>
        <Button variant="ghost" onClick={() => void load()} className="mt-2">
          Reintentar
        </Button>
      </div>
    );
  }

  const claim = summary ? documentClaim(summary) : undefined;
  const status = claim?.status ?? "no_presentada";
  const showForm = status === "no_presentada" || status === "rechazada";

  return (
    <div className="p-4">
      {/* Encabezado con el estado actual */}
      <div className="flex items-start gap-3">
        {/* Celeste (cielo), no naranja ni petróleo: es el rol de
            confianza/verificación de la identidad visual nueva (mockups
            03/09), el mismo tinte que la insignia de perfil verificado. No es
            una acción ni un estado de éxito genérico. */}
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cielo-tint text-cielo-text">
          <ShieldIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold text-ink">
            Verificación de identidad
          </p>
          {status === "verificada" ? (
            <div className="mt-1.5">
              <IdentityVerifiedBadge verified />
              <p className="mt-1.5 text-sm text-ink/55">
                Los comercios ven que tu identidad está verificada. No guardamos
                tu DNI: sólo queda la constancia de la verificación.
              </p>
            </div>
          ) : status === "pendiente" ? (
            <p className="mt-1 text-sm text-ink/60">
              Estamos revisando tu documento. Te avisamos apenas esté listo.
            </p>
          ) : status === "rechazada" ? (
            <p className="mt-1 text-sm text-danger">
              {claim?.rejection_reason
                ? `Rechazada: ${claim.rejection_reason}. Podés reenviar.`
                : "No pudimos verificarla. Probá con fotos más nítidas."}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink/60">
              Subí tu DNI y una selfie para que un comercio pueda confiar en que
              sos quien decís. Lleva un minuto.
            </p>
          )}
        </div>
      </div>

      {/* Formulario de envío / reenvío */}
      {showForm && (
        <div className="mt-4">
          <div className="flex gap-3">
            <DocSlot
              label="DNI (frente)"
              hint="Foto nítida, datos legibles"
              value={dniFront}
              onChange={setDniFront}
            />
            <DocSlot
              label="Selfie"
              hint="Tu cara, con buena luz"
              value={selfie}
              onChange={setSelfie}
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink/45">
            Usamos estas imágenes sólo para verificar tu identidad y las
            eliminamos una vez revisadas (Ley 25.326).
          </p>
          {submitError && <p className="mt-2 text-sm text-danger">{submitError}</p>}
          <Button
            onClick={handleSubmit}
            disabled={!dniFront || !selfie || submitting}
            loading={submitting}
            className="mt-3 w-full"
          >
            {status === "rechazada" ? "Reenviar a revisión" : "Enviar a revisión"}
          </Button>
        </div>
      )}
    </div>
  );
}
