"use client";

import { useRef, useState } from "react";
import { uploadFile } from "@/lib/cloudinary";
import { getErrorMessage } from "@/lib/errors";
import { TextField } from "@/components/ui";
import { FileTextIcon, TrashIcon, UploadIcon } from "@/components/icons";

const ACCEPT = ".pdf,.doc,.docx,image/*";

/**
 * CV del trabajador: antes sólo había un campo de texto para pegar un link
 * (Drive, LinkedIn) — pedido real de Julieta de poder arrastrar un PDF o una
 * foto directo, más simple que ir a buscar un link. Sube a Cloudinary
 * (`uploadFile`, resource_type `auto`: acepta PDF/imagen/doc) y sigue
 * guardando una URL en `cv_url` — el campo de texto queda como alternativa
 * para quien ya tiene el link a mano.
 */
export default function CvUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const url = await uploadFile(file);
      onChange(url);
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
  // sólo el nombre de archivo en vez de la URL completa (más legible).
  const fileName = value && value.includes("res.cloudinary.com") ? value.split("/").pop() : null;

  return (
    <div>
      {/* No es un `<label>`: abajo hay un dropzone/archivo adjunto o un
          campo de texto alternativo, no un único control fijo asociable —
          jsx-a11y/label-has-associated-control, TECH_DEBT.md F4. */}
      <p className="block text-sm font-medium text-ink/70">CV</p>
      <p className="mt-0.5 text-xs text-ink/50">
        Opcional. Un CV le da más seguridad al comercio a la hora de elegir.
      </p>

      {fileName ? (
        <div className="mt-2 flex items-center gap-2.5 rounded-[var(--radius-input)] bg-surface px-3.5 py-2.5 ring-1 ring-line">
          <FileTextIcon size={18} className="shrink-0 text-ink/50" />
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-sm font-medium text-primary-text underline decoration-transparent hover:decoration-current"
          >
            {fileName}
          </a>
          <button
            type="button"
            aria-label="Quitar CV"
            onClick={() => onChange("")}
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
            dragOver ? "border-primary bg-orange-50" : "border-line hover:bg-surface"
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

      {!fileName && (
        <div className="mt-2">
          <TextField
            label="O pegá un link"
            value={value}
            onChange={onChange}
            placeholder="Link a tu CV (Drive, PDF, LinkedIn)"
            inputMode="text"
          />
        </div>
      )}
    </div>
  );
}
