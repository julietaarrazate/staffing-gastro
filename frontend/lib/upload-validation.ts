/**
 * Reglas y mensajes de las subidas de archivos, en UN solo lugar (U052/U091):
 * antes cada tarjeta tenía su chequeo de peso y todo lo demás caía en el mismo
 * "No se pudo subir el archivo". Acá se distingue la causa: tipo no permitido,
 * demasiado pesado, o (en `cloudinary.ts`) cualquier otra cosa.
 *
 * Los formatos espejan los que el backend firma (`backend/app/core/cloudinary.py`
 * → ALLOWED_*_FORMATS); el límite es el de Cloudinary free (~10MB). No es
 * seguridad —un cliente hostil lo saltea; la firma del servidor es la que
 * manda— sino avisar rápido y claro antes de subir.
 */
export const MAX_UPLOAD_MB = 10;

export type UploadKind = "cv" | "business" | "image";

const RULES: Record<UploadKind, { exts: string[]; label: string }> = {
  cv: { exts: ["pdf", "doc", "docx", "jpg", "jpeg", "png"], label: "PDF, Word, JPG o PNG" },
  business: { exts: ["pdf", "jpg", "jpeg", "png"], label: "PDF, JPG o PNG" },
  image: { exts: ["jpg", "jpeg", "png", "webp", "heic", "heif"], label: "JPG, PNG, WebP o HEIC" },
};

const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function notAllowedMessage(kind: UploadKind): string {
  return `Ese tipo de archivo no está permitido. Subí ${RULES[kind].label}.`;
}

export function tooHeavyMessage(sizeBytes?: number): string {
  const actual = sizeBytes ? ` (pesa ${Math.ceil(sizeBytes / (1024 * 1024))}MB)` : "";
  return `El archivo es demasiado pesado${actual}. El máximo es ${MAX_UPLOAD_MB}MB.`;
}

/** Mensaje en español si el archivo no se puede subir; `null` si está bien. */
export function checkUploadFile(file: File, kind: UploadKind): string | null {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : MIME_EXT[file.type] ?? "";
  if (!RULES[kind].exts.includes(ext)) return notAllowedMessage(kind);
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return tooHeavyMessage(file.size);
  return null;
}

/** Para elegir una foto antes de encuadrarla: sólo exige que sea una imagen. */
export function checkPhotoFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return notAllowedMessage("image");
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return tooHeavyMessage(file.size);
  return null;
}

/** Traduce el error que devuelve Cloudinary (por si el chequeo local no lo vio). */
export function cloudinaryErrorMessage(raw: string | undefined, kind: UploadKind): string {
  const m = (raw ?? "").toLowerCase();
  if (/too large|file size|maximum is/.test(m)) return tooHeavyMessage();
  if (/format|extension|not allowed|invalid image|unsupported/.test(m)) return notAllowedMessage(kind);
  return "No se pudo subir el archivo. Probá de nuevo.";
}
