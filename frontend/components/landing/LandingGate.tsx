"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import LandingCorta from "@/components/landing/LandingCorta";

// La puerta de "/": la landing para visitantes, la home del rol para quien ya
// entró. Es cliente porque depende de la sesión; la página (app/page.tsx)
// queda de servidor para poder llevar metadata y datos estructurados.

// Home de cada rol: a dónde mandamos a un usuario ya logueado. La landing es
// marketing (para visitantes sin sesión); quien ya entró va directo a su app.
const HOME_BY_ROLE: Record<string, string> = {
  worker: "/feed",
  employer: "/shifts",
  admin: "/admin",
};

export default function LandingGate() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Si ya hay sesión, no mostramos la landing de marketing: redirigimos a la
  // home del rol. La landing queda sólo para visitantes sin cuenta.
  useEffect(() => {
    if (!loading && user) {
      router.replace(HOME_BY_ROLE[user.role] ?? "/feed");
    }
  }, [loading, user, router]);

  // Sólo ocultamos la landing cuando YA sabemos que hay sesión (redirigiendo a
  // la home del rol). Antes se ocultaba también mientras `loading` — pero como
  // esta ruta se prerenderiza estática y en el prerender `loading` arranca en
  // `true`, el HTML estático salía VACÍO: el visitante veía blanco hasta que el
  // cliente hidrataba y verificaba sesión. Al no bloquear por `loading`, el
  // contenido de marketing queda en el HTML estático y pinta al instante; el
  // usuario logueado igual se va por el `useEffect` de arriba (un parpadeo
  // breve del landing es preferible a un blanco para todos los visitantes).
  if (user) return null;

  return <LandingCorta />;
}
