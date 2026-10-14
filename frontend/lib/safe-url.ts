/**
 * URLs que cargó un usuario (CV, evidencias del DNI) antes de ponerlas en un
 * `href`. Sólo pasan las `https://` absolutas; cualquier otra cosa
 * (`javascript:`, `data:`, `http:`, texto suelto) devuelve `null` y el enlace
 * no se muestra. El backend ya las rechaza al guardarlas (auditoría
 * 2026-10-14, `backend/app/core/url.py`); esto cubre los datos viejos.
 */
export function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.host ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Lo que la persona pega en "O pegá un link" (CV), listo para guardar: sin
 * esquema se completa con `https://` (`linkedin.com/in/…`), `http://` pasa a
 * `https://`, y lo demás se manda tal cual para que el backend lo rechace con
 * un mensaje claro. Vacío = sin CV.
 */
export function normalizeUserLink(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^http:\/\//i.test(v)) return `https://${v.slice(7)}`;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return `https://${v.replace(/^\/+/, "")}`;
  return v;
}
