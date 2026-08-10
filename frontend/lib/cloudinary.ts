import { api } from "@/lib/api";

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
 * Fuerza la descarga (en vez de mostrarla en el navegador) de un archivo
 * subido a Cloudinary agregando la transformación `fl_attachment`, que hace
 * que Cloudinary responda con `Content-Disposition: attachment` — el
 * atributo HTML `download` no alcanza porque `res.cloudinary.com` es un
 * origen cruzado y los navegadores lo ignoran ahí. Pensado para que el
 * comercio pueda guardar una copia del CV del trabajador, no sólo verlo.
 * URLs que no son de Cloudinary (link pegado a mano) se devuelven tal cual
 * — no podemos garantizar el comportamiento de descarga en esos casos.
 */
export function cldAttachment(url: string): string {
  const marker = "/upload/";
  const at = url.indexOf(marker);
  if (!url.includes("res.cloudinary.com") || at === -1) return url;
  const head = url.slice(0, at + marker.length);
  const tail = url.slice(at + marker.length);
  if (tail.startsWith("fl_attachment")) return url;
  return `${head}fl_attachment/${tail}`;
}

export async function uploadImage(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error("La subida de archivos no está configurada todavía.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error("No se pudo subir el archivo. Probá de nuevo.");
  }
  const data = await res.json();
  return data.secure_url as string;
}

/**
 * Sube el CV con una subida FIRMADA (en vez del `upload_preset` unsigned de
 * `uploadFile`): Cloudinary bloquea por default la entrega de PDF subido sin
 * firma (medida anti-abuso desde 2023) — causa real confirmada de que el CV
 * suba bien pero no abra (`ERR_INVALID_RESPONSE`). El backend firma la
 * subida (`POST /uploads/sign-cv`, sólo trabajador) sin ver el archivo; si
 * no está configurada en el servidor (`CLOUDINARY_API_KEY`/`_SECRET`), tira
 * un error claro (503) en vez de fallar en silencio.
 */
export async function uploadCv(file: File, token: string): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new Error("La subida de archivos no está configurada todavía.");
  }

  const { timestamp, signature, api_key, allowed_formats } = await api.post<{
    timestamp: string;
    signature: string;
    api_key: string;
    allowed_formats: string;
  }>("/uploads/sign-cv", undefined, token);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", api_key);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  formData.append("allowed_formats", allowed_formats);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error("No se pudo subir el archivo. Probá de nuevo.");
  }
  const data = await res.json();
  return data.secure_url as string;
}
