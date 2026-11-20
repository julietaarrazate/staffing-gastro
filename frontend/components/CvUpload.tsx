"use client";

import { useRef, useState } from "react";
import { uploadCv } from "@/lib/cloudinary";
import { CV_OPEN_ERROR } from "@/lib/cv";
import { getErrorMessage } from "@/lib/errors";
import type { CvFileRef } from "@/lib/types";
import { TextField } from "@/components/ui";
import { FileTextIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { safeHttpsUrl } from "@/lib/safe-url";
import { checkUploadFile } from "@/lib/upload-validation";

const ACCEPT = ".pdf,.doc,.docx,image/*";

/** Lo que el formulario guarda del CV. */
export interface CvValue {
  /** El CV subido: privado (ADR-0021, actualización 2026-11-19). */
  file: CvFileRef | null;
  /** Link pegado a mano, o la URL de un CV viejo todavía público. */
  url: string;
  /** Nombre original del archivo subido (F1, auditoría 2026-08-10): el
   * `public_id` de Cloudinary es un hash, no sirve para mostrar. `null` con un
   * link pegado a mano. */
  fileName: string | null;
}

export const NO_CV: CvValue = { file: null, url: "", fileName: null };

/** ¿Es la URL de un CV subido antes del 2026-11-19 (público, de Cloudinary)? */
function isOldUpload(url: string): boolean {
  const safe = safeHttpsUrl(url);
  return Boolean(safe && new URL(safe).host === "res.cloudinary.com");
}

/**
 * CV del trabajador: arrastrar un PDF, un Word o una foto (pedido de
 * Julieta), o pegar un link (Drive, LinkedIn) para quien ya lo tiene a mano.
 *
 * Desde el 2026-11-19 el archivo sube PRIVADO (`uploadCv`): trae teléfono,
 * email y domicilio, y antes quien vio el link una vez lo abría para siempre.
 * No hay URL que lo muestre: se abre con un link que vence que da el backend
 * (`onOpen`), y eso sólo para el CV ya guardado; uno recién subido se puede
 * abrir después de tocar «Guardar».
 */
export default function CvUpload({
  value,
  token,
  onChange,
  onOpen,
}: {
  value: CvValue;
  /** Necesario para firmar la subida server-side (`POST /uploads/sign-cv`). */
  token: string | null;
  onChange: (next: CvValue) => void;
  /** Abre el CV guardado con un link que vence; `false` si no se pudo. */
  onOpen?: () => Promise<boolean>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    if (!token) return;
    setError(null);
    // Tipo y peso con mensaje propio (U052); el límite sale de un solo lugar.
    const problem = checkUploadFile(file, "cv");
    if (problem) {
      setError(problem);
      return;
    }
    setUploading(true);
    try {
      const ref = await uploadCv(file, token);
      onChange({ file: ref, url: "", fileName: file.name });
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo subir el archivo"));
    } finally {
      setUploading(false);
    }
  }

  async function open() {
    if (!onOpen) return;
    setError(null);
    if (!(await onOpen())) setError(CV_OPEN_ERROR);
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

  // Un archivo subido (o un CV viejo de Cloudinary) se muestra por su nombre;
  // si no hay nombre guardado (perfil viejo), el de la URL o uno genérico.
  const isUploadedFile = Boolean(value.file) || isOldUpload(value.url);
  const displayName =
    value.fileName ?? (value.file ? "CV subido" : (value.url.split("/").pop() ?? "CV subido"));

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
        <div className="campo mt-2 flex items-center gap-2.5 rounded-[var(--radius-input)] bg-surface px-3.5 py-2.5 ring-1 ring-line">
          <FileTextIcon size={18} className="shrink-0 text-ink/50" />
          {onOpen ? (
            <button
              type="button"
              onClick={() => void open()}
              title="Ver tu CV"
              className="min-w-0 flex-1 truncate text-left text-sm font-medium text-primary-text underline decoration-transparent hover:decoration-current"
            >
              {displayName}
            </button>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink/80">
              {displayName}
            </span>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 text-xs font-semibold text-primary-text hover:underline disabled:opacity-60"
          >
            {uploading ? "Subiendo..." : "Reemplazar"}
          </button>
          <button
            type="button"
            aria-label="Quitar CV"
            onClick={() => onChange(NO_CV)}
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
          className={`cv-soltar mt-2 flex w-full flex-col items-center gap-1.5 rounded-[var(--radius-input)] border-2 border-dashed px-4 py-5 text-center transition disabled:opacity-60 ${
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
          <span className="text-xs text-ink/40">PDF, Word o foto, hasta 10MB</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleFileInput} className="hidden" />
      {error && <p className="mt-1 text-xs text-danger-text">{error}</p>}

      {!isUploadedFile && (
        <div className="mt-2">
          <TextField
            label="O pegá un link"
            value={value.url}
            onChange={(v) => onChange({ file: null, url: v, fileName: null })}
            placeholder="Link a tu CV (Drive, PDF, LinkedIn)"
            inputMode="text"
          />
        </div>
      )}
    </div>
  );
}
