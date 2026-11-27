/**
 * «Cómo llegar»: enlace universal de Google Maps al local de un turno. En el
 * celular abre la app de mapas que la persona tenga elegida. Con coordenadas
 * va al punto exacto; sin ellas, a la dirección escrita. Sin ninguna de las
 * dos, `null` (no se ofrece el botón).
 *
 * Sólo lo usan pantallas con sesión: la página pública `/turno/[id]` no recibe
 * dirección ni coordenadas del servidor.
 */
export function comoLlegarHref(lugar: {
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): string | null {
  const base = "https://www.google.com/maps/dir/?api=1&destination=";
  if (lugar.latitude != null && lugar.longitude != null) {
    return `${base}${lugar.latitude},${lugar.longitude}`;
  }
  const direccion = lugar.address?.trim();
  if (!direccion) return null;
  const ciudad = lugar.city?.trim();
  return `${base}${encodeURIComponent(ciudad ? `${direccion}, ${ciudad}` : direccion)}`;
}

/** La dirección como se lee: «Gorriti 5000, Palermo», o sólo la zona si no hay dirección. */
export function lugarDelTurno(lugar: { address?: string | null; city?: string | null }): string | null {
  const direccion = lugar.address?.trim();
  const ciudad = lugar.city?.trim();
  if (direccion) return ciudad ? `${direccion}, ${ciudad}` : direccion;
  return ciudad || null;
}
