"use client";

import { useRef, useState } from "react";
import { uploadCv } from "@/lib/cloudinary";
import { getErrorMessage } from "@/lib/errors";
import { TextField } from "@/components/ui";
import { FileTextIcon, TrashIcon, UploadIcon } from "@/components/icons";

const ACCEPT = ".pdf,.doc,.docx,image/*";
// Resguardo de cuota (no de seguridad — un cliente hostil puede saltearlo):
// el plan free de Cloudinary es de a millares de CVs (~25GB), pero un
// archivo gigante subido sin querer sí lo pega. Cloudinary mismo ya limita
// ~10MB por imagen en el plan free; usamos el mismo tope para todo tipo de
// CV por simplicidad.
const MAX_CV_SIZE_MB = 10;

/**
 * CV del trabajador: antes sólo había un campo de texto para pegar un link
 * (Drive, LinkedIn) — pedido real de Julieta de poder arrastrar un PDF o una
 * foto directo, más simple que ir a buscar un link. Sube con firma del
 * servidor (`uploadCv`, C.2(b) auditoría 2026-08-10: evita el bloqueo de
 * Cloudinary a la entrega de PDF subido sin firmar) y sigue guardando una
 * URL en `cv_url` — el campo de texto queda como alternativa para quien ya
 * tiene el link a mano.
 */
export default function CvUpload({
  value,
  fileName,
  token,
  onChange,
}: {
  value: string;
  /** Nombre original del archivo subido (F1, auditoría 2026-08-10): el
   * `public_id` de Cloudinary es un hash, no sirve para mostrar. `null`
   * cuando `value` es un link pegado a mano, o un archivo subido antes de
   * este campo existir (en ese caso se cae al nombre derivado de la URL). */
  fileName: string | null;
  /** Necesario para firmar la subida server-side (`POST /uploads/sign-cv`). */
  token: string | null;
  onChange: (url: string, fileName: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    if (!token) return;
    setError(null);
    if (file.size > MAX_CV_SIZE_MB * 1024 * 1024) {
      setError(`El archivo pesa más de ${MAX_CV_SIZE_MB}MB. Subí uno más liviano.`);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadCv(file, token);
      onChange(url, file.name);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo subir el archivo"));
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) upload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  // Si `value` ya es un archivo que subimos nosotros (Cloudinary), mostramos
  // el nombre de archivo en vez de la URL completa (más legible). Preferimos
  // el `fileName` guardado (nombre real); si no está (perfil viejo, de antes
  // de este campo), caemos al nombre derivado de la URL como antes.
  const isUploadedFile = Boolean(value && value.includes("res.cloudinary.com"));
  const displayName = isUploadedFile ? (fileName ?? value.split("/").pop() ?? null) : null;

  return (
    <div>
      {/* No es un `<label>`: abajo hay un dropzone/archivo adjunto o un
          campo de texto alternativo, no un único control fijo asociable —
          jsx-a11y/label-has-associated-control, TECH_DEBT.md F4. */}
      <p className="block text-sm font-medium text-ink/70">CV</p>
      <p className="mt-0.5 text-xs text-ink/50">
        Opcional. Un CV le da más seguridad al comercio a la hora de elegir.
      </p>

      {isUploadedFile ? (
        <div className="mt-2 flex items-center gap-2.5 rounded-[var(--radius-input)] bg-surface px-3.5 py-2.5 ring-1 ring-line">
          <FileTextIcon size={18} className="shrink-0 text-ink/50" />
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-sm font-medium text-primary-text underline decoration-transparent hover:decoration-current"
          >
            {displayName}
          </a>
          <button
            type="button"
            aria-label="Quitar CV"
            onClick={() => onChange("", null)}
            className="shrink-0 text-ink/40 hover:text-danger-text"
          >
            <TrashIcon size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          disabled={uploading}
          className={`mt-2 flex w-full flex-col items-center gap-1.5 rounded-[var(--radius-input)] border-2 border-dashed px-4 py-5 text-center transition disabled:opacity-60 ${
            dragOver ? "border-primary bg-primary-tint" : "border-line hover:bg-surface"
          }`}
        >
          {uploading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <UploadIcon size={20} className="text-ink/40" />
          )}
          <span className="text-sm font-medium text-ink/70">
            {uploading ? "Subiendo..." : "Arrastrá tu CV acá, o tocá para elegir un archivo"}
          </span>
          <span className="text-xs text-ink/40">PDF, Word o foto</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleFileInput} className="hidden" />
      {error && <p className="mt-1 text-xs text-danger-text">{error}</p>}

      {!isUploadedFile && (
        <div className="mt-2">
          <TextField
            label="O pegá un link"
            value={value}
            onChange={(v) => onChange(v, null)}
            placeholder="Link a tu CV (Drive, PDF, LinkedIn)"
            inputMode="text"
          />
        </div>
      )}
    </div>
  );
}
