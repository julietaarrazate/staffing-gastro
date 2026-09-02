"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/cloudinary";
import { getErrorMessage } from "@/lib/errors";
import { CameraIcon } from "@/components/icons";
import ImageCropModal from "@/components/ImageCropModal";

export default function ImageUpload({
  value,
  onChange,
  fallbackLabel,
  shape = "circle",
  compact = false,
}: {
  value: string | null;
  onChange: (url: string) => void;
  fallbackLabel: string;
  shape?: "circle" | "square";
  /** Sin el círculo grande: sólo el botón de texto. Para cuando la foto ya
   *  se ve en otro lado de la misma pantalla (WorkerProfileForm, "Mi perfil"
   *  — reporte real de Julieta, "no puede tener dos veces fotos") y
   *  repetirla acá era pura redundancia, no una segunda función. */
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Foto elegida, pendiente de encuadrar antes de subirse (ver ImageCropModal).
  const [pendingFile, setPendingFile] = useState<File | null>(null);

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
      const url = await uploadImage(cropped);
      onChange(url);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo subir la imagen"));
    } finally {
      setUploading(false);
    }
  }

  const rounded = shape === "circle" ? "rounded-full" : "rounded-2xl";

  return (
    <div className="flex flex-col items-center gap-2">
      {!compact && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`group relative flex h-24 w-24 items-center justify-center overflow-hidden ${rounded} bg-gradient-to-br from-primary to-primary-strong text-2xl font-bold text-white shadow-md transition active:scale-95 disabled:opacity-70`}
        >
          {value ? (
            <img
              src={value}
              alt={fallbackLabel}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            fallbackLabel.charAt(0).toUpperCase()
          )}
          {/* En celular no hay hover: con `opacity-0 group-hover:opacity-100` el
              ícono de cámara NUNCA se veía y la foto parecía no ser tocable.
              Con foto cargada se muestra una insignia de cámara permanente en la
              esquina (patrón de perfil nativo); sin foto, el overlay va visible
              de entrada porque ahí la acción es el punto de la pantalla. */}
          <span
            className={`absolute inset-0 flex items-center justify-center bg-black/40 text-white transition ${
              uploading || !value ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            {uploading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <CameraIcon size={22} />
            )}
          </span>
          {value && !uploading && (
            <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-night text-white ring-2 ring-white">
              <CameraIcon size={14} />
            </span>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={
          compact
            ? "inline-flex items-center gap-1.5 text-sm font-semibold text-primary-text disabled:opacity-60"
            : "text-xs font-semibold text-primary disabled:opacity-60"
        }
      >
        {compact && <CameraIcon size={15} />}
        {uploading
          ? "Subiendo..."
          : value
            ? compact
              ? "Cambiar foto de perfil"
              : "Cambiar foto"
            : compact
              ? "Subir foto de perfil"
              : "Subir foto"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
      <ImageCropModal
        file={pendingFile}
        shape={shape}
        onCancel={() => setPendingFile(null)}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
