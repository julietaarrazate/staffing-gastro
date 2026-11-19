import { api } from "@/lib/api";
import { cloudinaryErrorMessage, type UploadKind } from "@/lib/upload-validation";

/**
 * Devuelve una variante optimizada de una imagen de Cloudinary: formato y
 * calidad automáticos (`f_auto,q_auto` → WebP/AVIF) y ancho tope al tamaño real
 * de render (`w_<n>,c_limit` no sobreescala) con densidad de pantalla
 * (`dpr_auto` para retina). Evita bajar la foto original (1–4 MB) para
 * encogerla en una tarjeta/avatar — clave en el feed foto-first sobre datos
 * móviles.
 *
 * URLs que no son de Cloudinary (avatares de Google, seed de otros hosts) se
 * devuelven tal cual. Idempotente: si la URL ya trae transformaciones no las
 * duplica. `null`/`undefined` pasan derecho (el `<img>`/Avatar ya maneja la
 * ausencia de foto).
 */
export function cldThumb(url: string | null | undefined, width: number): string | undefined {
  if (!url) return url ?? undefined;
  const marker = "/image/upload/";
  const at = url.indexOf(marker);
  if (!url.includes("res.cloudinary.com") || at === -1) return url;
  const head = url.slice(0, at + marker.length);
  const tail = url.slice(at + marker.length);
  // Ya transformada (o versionada con transform previa): no tocar.
  if (/^(f_auto|q_auto|w_\d|c_|dpr_)/.test(tail)) return url;
  return `${head}f_auto,q_auto,c_limit,dpr_auto,w_${width}/${tail}`;
}

/**
 * Variante de una foto de Cloudinary para la vista previa de un link
 * compartido (Open Graph): recortada al tamaño pedido (1200×630 por defecto;
 * cuadrada para `og:image`, que WhatsApp muestra grande), en JPEG explícito.
 * No `f_auto` como `cldThumb`: los que arman la vista previa (WhatsApp,
 * Slack) no siempre aceptan WebP/AVIF, y `f_auto` elige según quién pide.
 * URLs que no son de Cloudinary se devuelven tal cual.
 */
export function cldOgImage(url: string, width = 1200, height = 630): string {
  const marker = "/image/upload/";
  const at = url.indexOf(marker);
  if (!url.includes("res.cloudinary.com") || at === -1) return url;
  return `${url.slice(0, at + marker.length)}f_jpg,q_auto,c_fill,g_auto,w_${width},h_${height}/${url.slice(at + marker.length)}`;
}

/**
 * Sube una foto pública (perfil o logo, portada del comercio) con una subida
 * FIRMADA por el backend (`POST /uploads/sign-image`). Antes usaba un preset
 * unsigned que viajaba en el código del navegador, y con él cualquiera podía
 * subir lo que quisiera a la cuenta (auditoría de seguridad 2026-10-14). La
 * carpeta y el nombre del archivo los decide el servidor.
 *
 * El DNI y la selfie NO van por acá: son privados (`uploadIdentityImage`).
 */
export type ImageKind = "profile" | "cover";

export async function uploadImage(file: File, token: string, kind: ImageKind): Promise<string> {
  return (await uploadSigned(file, token, `/uploads/sign-image?kind=${kind}`)).secure_url;
}

/**
 * Referencia a un archivo PRIVADO en Cloudinary (ADR-0021): DNI, selfie,
 * constancia de AFIP o CV. No es una URL — no hay URL pública que lo muestre.
 * Se manda tal cual al backend; se vuelve a ver sólo con un link que vence a
 * los 5 minutos (el DNI y la constancia, un admin; el CV, quien hoy lo puede
 * ver). El tipo de entrega es `authenticated`: ni el original ni una versión
 * transformada se ven sin firma (`private` dejaba ver las transformadas,
 * revisión del 2026-11-19).
 */
export interface PrivateFileRef {
  public_id: string;
  resource_type: string;
  format: string;
  type: "authenticated";
}

/** Sube el DNI o la selfie, privados (ADR-0021). */
export async function uploadIdentityImage(file: File, token: string): Promise<PrivateFileRef> {
  return toPrivateRef(await uploadSigned(file, token, "/uploads/sign-image?kind=identity"));
}

/**
 * Sube el CV con una subida FIRMADA por el backend (`POST /uploads/sign-cv`,
 * sólo trabajador). Desde el 2026-11-19 es PRIVADO, como el DNI (ADR-0021):
 * el CV trae teléfono, email y domicilio, y antes cualquiera con el link lo
 * abría para siempre. Devuelve la referencia, no una URL; el comercio que
 * puede verlo pide un link que vence (`lib/cv.ts`). Si la subida no está
 * configurada en el servidor, tira un error claro (503).
 */
export async function uploadCv(file: File, token: string): Promise<PrivateFileRef> {
  return toPrivateRef(await uploadSigned(file, token, "/uploads/sign-cv", "cv"));
}

/**
 * Sube la constancia de inscripción de AFIP del comercio (ADR-0013). Misma
 * subida firmada que el CV y por el mismo motivo —la constancia es un PDF y
 * Cloudinary no entrega PDF subido sin firma— pero contra su propio endpoint:
 * la lista de formatos viaja DENTRO de la firma, y la de la constancia es más
 * angosta (sin `doc`/`docx`). Reusar la firma del CV le daría al comercio
 * permiso para subir formatos que este flujo no necesita. Privada (ADR-0021).
 */
export async function uploadBusinessDocument(
  file: File,
  token: string
): Promise<PrivateFileRef> {
  return toPrivateRef(await uploadSigned(file, token, "/uploads/sign-business-document", "business"));
}

/** Lo que contesta Cloudinary a una subida (los campos que usamos). */
interface UploadResult {
  secure_url: string;
  public_id: string;
  resource_type: string;
  format?: string;
  type: string;
}

function toPrivateRef(result: UploadResult): PrivateFileRef {
  if (result.type !== "authenticated") {
    // El backend firmó `type=authenticated`; si Cloudinary contesta otra cosa,
    // el archivo no quedó protegido y no hay que mandarlo como si lo fuera.
    throw new Error("No se pudo subir el archivo de forma privada. Probá de nuevo.");
  }
  return {
    public_id: result.public_id,
    resource_type: result.resource_type,
    format: result.format ?? "",
    type: "authenticated",
  };
}

async function uploadSigned(
  file: File,
  token: string,
  signEndpoint: string,
  kind: UploadKind = "image"
): Promise<UploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new Error("La subida de archivos no está configurada todavía.");
  }

  const { timestamp, signature, api_key, allowed_formats, folder, public_id, overwrite, type } =
    await api.post<{
      timestamp: string;
      signature: string;
      api_key: string;
      allowed_formats: string;
      folder: string;
      public_id: string;
      overwrite: string;
      type?: string | null;
    }>(signEndpoint, undefined, token);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", api_key);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  formData.append("allowed_formats", allowed_formats);
  // Firmados por el backend: carpeta, nombre al azar y no pisar archivos.
  formData.append("folder", folder);
  formData.append("public_id", public_id);
  formData.append("overwrite", overwrite);
  // Documentos de identidad y CV: `authenticated`, también firmado (ADR-0021).
  if (type) formData.append("type", type);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    // Cloudinary explica la causa en `error.message` (formato o peso): se
    // traduce en vez de mostrar siempre el mismo mensaje genérico (U091).
    let raw: string | undefined;
    try {
      raw = ((await res.json()) as { error?: { message?: string } }).error?.message;
    } catch {
      /* cuerpo sin JSON: queda el genérico */
    }
    throw new Error(cloudinaryErrorMessage(raw, kind));
  }
  return (await res.json()) as UploadResult;
}
