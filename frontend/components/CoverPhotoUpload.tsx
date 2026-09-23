"use client";

import { useRef, useState } from "react";
import { cldThumb, uploadImage } from "@/lib/cloudinary";
import { getErrorMessage } from "@/lib/errors";
import { CameraIcon, TrashIcon } from "@/components/icons";
import ImageCropModal from "@/components/ImageCropModal";

/**
 * Foto del local: la imagen grande de las tarjetas del feed y del detalle del
 * turno. Es lo primero que ve un trabajador de un comercio, y antes era el
 * logo estirado (un isotipo chico sobre fondo liso, a 800px de ancho) o un
 * bloque de color. Una foto del salón o de la barra dice "esto es un lugar
 * real, así se trabaja acá".
 *
 * Mismo flujo que el avatar (elegir → encuadrar → subir), en 16:9.
 */
export default function CoverPhotoUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick() {
    inputRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setPendingFile(file);
  }

  async function handleCropConfirm(cropped: File) {
    setPendingFile(null);
    setUploading(true);
    try {
      onChange(await uploadImage(cropped));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo subir la foto"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-ink/70">Foto del local</p>
      <p className="mt-0.5 text-xs text-ink/50">
        El salón, la barra o la fachada. Es lo primero que ven los trabajadores de tu turno.
      </p>

      <button
        type="button"
        onClick={pick}
        disabled={uploading}
        aria-label={value ? "Cambiar la foto del local" : "Subir una foto del local"}
        className="relative mt-2 block aspect-video w-full overflow-hidden rounded-[var(--radius-card)] bg-surface ring-1 ring-line transition active:scale-[0.99] disabled:opacity-70"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL de Cloudinary ya redimensionada (cldThumb)
          <img src={cldThumb(value, 800)} alt="Foto del local" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink/50">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-primary-text ring-1 ring-line">
              <CameraIcon size={20} />
            </span>
            <span className="text-sm font-semibold text-ink/70">Sumar una foto</span>
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </span>
        )}
      </button>

      {value && !uploading && (
        <div className="mt-2 flex items-center gap-4 text-xs font-semibold">
          <button type="button" onClick={pick} className="text-primary-text">
            Cambiar foto
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 text-ink/50 hover:text-danger-text"
          >
            <TrashIcon size={13} /> Sacar
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-danger-text">{error}</p>}

      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <ImageCropModal
        file={pendingFile}
        shape="wide"
        onCancel={() => setPendingFile(null)}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
