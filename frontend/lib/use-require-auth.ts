"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { loginHref } from "@/lib/safe-next";

/**
 * Guard de sesión para pantallas protegidas. Mientras `AuthProvider` restaura
 * la sesión (`loading` global), no hace nada — evita un redirect prematuro en
 * cada carga de página. Una vez resuelto, si no hay `token`, manda a
 * `/login`: antes, 13 pantallas leían sólo `token` de `useAuth()` (nunca el
 * `loading`/`user` global) y su `load()` hacía `if (!token) return;` sin
 * apagar su propio `loading` local — con sesión vencida o entrando por URL
 * directa sin login previo, quedaban con el skeleton girando para siempre,
 * sin ningún camino de salida (docs/TECH_DEBT.md, hallazgo D1 de la
 * auditoría de producto 2026-08-09).
 */
export function useRequireAuth() {
  const { user, token, loading, justLoggedOut, sessionEnded, reconnecting } = useAuth();
  const router = useRouter();

  // Recién salida de la cuenta, va a la landing como el propio `logout`
  // (2026-10-13): si mandara a "/login", este redirect de la pantalla que se
  // estaba viendo le ganaba al de la salida.
  //
  // Si la sesión terminó sola (venció, o la cuenta quedó suspendida), el
  // ingreso lo dice y guarda la ruta para volver (`next`). Con el servidor
  // sin contestar (`reconnecting`) no se manda a nadie a ningún lado: la
  // sesión sigue guardada y se está reintentando.
  useEffect(() => {
    if (loading || token || reconnecting) return;
    if (justLoggedOut) {
      router.replace("/");
      return;
    }
    const here = `${window.location.pathname}${window.location.search}`;
    router.replace(loginHref({ motivo: sessionEnded, next: here }));
  }, [loading, token, reconnecting, justLoggedOut, sessionEnded, router]);

  return { user, token, loading };
}
