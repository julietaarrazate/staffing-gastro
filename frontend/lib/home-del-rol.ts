/** Home de cada rol: a dónde mandamos a un usuario ya logueado (la landing es
 * para visitantes sin sesión). Una sola fuente para `LandingGate` y
 * `/verificar-email`. */
const HOME_BY_ROLE: Record<string, string> = {
  worker: "/feed",
  employer: "/shifts",
  admin: "/admin",
};

export function homeDelRol(role: string): string {
  return HOME_BY_ROLE[role] ?? "/feed";
}
