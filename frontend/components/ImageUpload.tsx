"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/cloudinary";
import { getErrorMessage } from "@/lib/errors";
import { CameraIcon } from "@/components/icons";

export default function ImageUpload({
  value,
  onChange,
  fallbackLabel,
  shape = "circle",
}: {
  value: string | null;
  onChange: (url: string) => void;
  fallbackLabel: string;
  shape?: "circle" | "square";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo subir la imagen"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const rounded = shape === "circle" ? "rounded-full" : "rounded-2xl";

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`group relative flex h-24 w-24 items-center justify-center overflow-hidden ${rounded} bg-gradient-to-br from-[#ff6b00] to-[#e85f00] text-2xl font-bold text-white shadow-md transition active:scale-95 disabled:opacity-70`}
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
        <span
          className={`absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100 ${
            uploading ? "opacity-100" : ""
          }`}
        >
          {uploading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <CameraIcon size={22} />
          )}
        </span>
      </button>
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
        className="text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-60"
      >
        {uploading ? "Subiendo..." : value ? "Cambiar foto" : "Subir foto"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
