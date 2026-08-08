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

export async function uploadImage(file: File): Promise<string> {
  return uploadToCloudinary(file, "image");
}

/**
 * Sube cualquier archivo (PDF, foto, doc) al endpoint `/auto/upload` de
 * Cloudinary, que detecta el tipo de recurso solo — a diferencia de
 * `uploadImage`, que pega directo a `/image/upload` y sólo acepta imágenes.
 * Usado por el CV del trabajador (`CvUpload.tsx`): antes sólo se podía pegar
 * un link, pedido real de Julieta de poder arrastrar un PDF o una foto.
 */
export async function uploadFile(file: File): Promise<string> {
  return uploadToCloudinary(file, "auto");
}

async function uploadToCloudinary(file: File, resourceType: "image" | "auto"): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error("La subida de archivos no está configurada todavía.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error("No se pudo subir el archivo. Probá de nuevo.");
  }
  const data = await res.json();
  return data.secure_url as string;
}
