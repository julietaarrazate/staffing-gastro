"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { uploadBusinessDocument } from "@/lib/cloudinary";
import { getErrorMessage } from "@/lib/errors";
import { businessClaim, type IdentitySummary } from "@/lib/identity";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { CheckCircleIcon, FileTextIcon, ShieldIcon, UploadIcon } from "@/components/icons";

const ACCEPT = ".pdf,image/*";
// Mismo resguardo de cuota que el CV (`CvUpload`): no es seguridad — un
// cliente hostil lo saltea — sino evitar que una subida sin querer se coma
// el plan free de Cloudinary. Una constancia de AFIP pesa unos pocos cientos
// de KB.
const MAX_SIZE_MB = 10;

/**
 * Verificación del comercio (ADR-0013): el análogo de
 * `IdentityVerificationCard` del trabajador, del otro lado del mercado.
 *
 * El sello "Comercio verificado" existía en `ShiftCard` desde el ADR-0011,
 * pero `company_verified` no podía dar `true` nunca porque nada creaba el
 * claim. Esta tarjeta es la pieza que faltaba.
 *
 * Por qué importa que exista, y no es simetría por prolijidad: hoy el
 * trabajador entrega DNI y selfie, y el comercio no entrega nada. El que
 * viaja a la dirección de un desconocido, trabaja y después tiene que cobrar
 * es el trabajador — la parte con más para perder y la que menos información
 * tiene sobre la otra.
 *
 * El copy no promete más de lo que hace: la revisa una persona (el método es
 * `admin_manual`), no se valida el CUIT contra AFIP. Mismo criterio que el
 * mail de verificación de identidad del trabajador.
 */
export default function BusinessVerificationCard() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<IdentitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;
    setError(null);
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`El archivo pesa más de ${MAX_SIZE_MB}MB. Subí uno más liviano.`);
      return;
    }
    setUploading(true);
    try {
      setFileUrl(await uploadBusinessDocument(file, token));
      setFileName(file.name);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo subir el archivo"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!token || !fileUrl) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.post<IdentitySummary>(
        "/identity/me/business",
        { constancia_url: fileUrl },
        token
      );
      setSummary(updated);
      setFileUrl(null);
      setFileName(null);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo enviar la verificación"));
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
        <p className="text-sm text-ink/60">
          No se pudo cargar el estado de tu comercio.
        </p>
        <Button variant="ghost" onClick={() => void load()} className="mt-2">
          Reintentar
        </Button>
      </div>
    );
  }

  const claim = summary ? businessClaim(summary) : undefined;
  const status = claim?.status ?? "no_presentada";
  const showForm = status === "no_presentada" || status === "rechazada";

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        {/* Mismo truco que la tarjeta del trabajador: `bg-card` (no
            `bg-cielo-tint`) porque el contenedor entero ya es celeste, así
            que el chip necesita contraste contra ESE fondo. */}
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-cielo-text">
          <ShieldIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold text-ink">
            Verificación del comercio
          </p>
          {status === "verificada" ? (
            <div className="mt-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cielo-tint px-2.5 py-1 text-xs font-semibold text-cielo-text">
                <CheckCircleIcon size={13} />
                Comercio verificado
              </span>
              <p className="mt-1.5 text-sm text-ink/55">
                Los trabajadores ven este sello en tus turnos. No guardamos tu
                constancia: sólo queda el registro de la verificación.
              </p>
            </div>
          ) : status === "pendiente" ? (
            <p className="mt-1 text-sm text-ink/60">
              Estamos revisando tu constancia. Te avisamos apenas esté lista.
            </p>
          ) : status === "rechazada" ? (
            <p className="mt-1 text-sm text-danger">
              {claim?.rejection_reason
                ? `Rechazada: ${claim.rejection_reason}. Podés reenviar.`
                : "No pudimos verificarla. Revisá que se lea bien y reenviá."}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink/60">
              Subí la constancia de inscripción de AFIP para que los
              trabajadores vean que tu local es un negocio registrado. Un turno
              de un comercio verificado se acepta más rápido.
            </p>
          )}
        </div>
      </div>

      {showForm && (
        <div className="mt-4">
          {/* No es un `<label>`: es un botón que abre el selector de
              archivos, no un control asociable — jsx-a11y/
              label-has-associated-control, mismo criterio que `CvUpload`. */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left ring-1 ring-line transition active:scale-[0.99] disabled:opacity-70"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink/60">
              {uploading ? (
                <Spinner size={16} />
              ) : fileUrl ? (
                <FileTextIcon size={17} />
              ) : (
                <UploadIcon size={17} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">
                {fileUrl ? fileName : "Subir constancia"}
              </span>
              <span className="block text-xs text-ink/50">
                {fileUrl ? "Tocá para cambiarla" : "PDF o foto, hasta 10MB"}
              </span>
            </span>
            {fileUrl && !uploading && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
                <CheckCircleIcon size={14} />
              </span>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFile}
            className="hidden"
          />

          <p className="mt-3 text-[11px] leading-relaxed text-ink/45">
            La bajás gratis del sitio de AFIP con tu CUIT. La revisa una
            persona de nuestro equipo y la eliminamos una vez revisada
            (Ley 25.326).
          </p>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <Button
            onClick={handleSubmit}
            disabled={!fileUrl || uploading || submitting}
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
