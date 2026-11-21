/** Las pantallas del comercio donde ya se está publicando: ahí «Publicar
 *  turno» no va ni al lado de la barra de abajo ni en la de arriba. */
const PUBLICANDO = ["/shifts/new", "/shifts/new-event"];

export function estaPublicando(pathname: string): boolean {
  return PUBLICANDO.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
