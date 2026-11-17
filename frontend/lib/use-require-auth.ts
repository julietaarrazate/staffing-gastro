"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { homeDelRol } from "@/lib/home-del-rol";
import { loginHref } from "@/lib/safe-next";
import type { UserRole } from "@/lib/types";

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
 *
 * Con `roles`, además es guarda de rol (U098): una persona logueada que entra
 * por URL a la pantalla de otro rol iba a ver la pantalla vacía con
 * «Permisos insuficientes». Ya con la sesión resuelta, si su rol no está en
 * la lista se la manda a la home de su rol y mientras tanto se devuelve
 * `token: null`, para que la pantalla no dispare sus pedidos. Sin `roles`
 * se comporta como siempre. Los roles son los que el backend exige en los
 * endpoints de la pantalla.
 */
export function useRequireAuth({ roles }: { roles?: readonly UserRole[] } = {}) {
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

  // El `user` queda en "Ver como" con el de la cuenta que se mira, así que
  // la guarda juzga ese rol (el mismo que ve el backend con su token).
  const wrongRole = !loading && !!user && !!token && !!roles && !roles.includes(user.role);
  useEffect(() => {
    if (wrongRole && user) router.replace(homeDelRol(user.role));
  }, [wrongRole, user, router]);

  return { user, token: wrongRole ? null : token, loading, allowed: !wrongRole };
}
