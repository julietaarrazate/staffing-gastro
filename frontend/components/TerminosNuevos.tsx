"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { Button, Modal, useToast } from "@/components/ui";

/** Las páginas que se tienen que poder leer antes de aceptar. */
const LEGALES = ["/terminos", "/privacidad"];

/**
 * Los Términos cambiaron desde lo último que aceptó esta persona
 * (`terms_acceptance_required` en `/auth/me`): la app le pide aceptar la
 * versión vigente antes de seguir (decisión de Julieta, 2026-11-26). Antes la
 * aceptación sólo quedaba registrada al crear la cuenta.
 *
 * No se puede cerrar sin decidir: se acepta o se cierra la sesión. No aparece
 * sobre las páginas legales (hay que poder leerlas), ni mientras una admin
 * mira la cuenta de otra persona con «Ver como»: aceptar es de la persona.
 */
export default function TerminosNuevos() {
  const { user, token, impersonating, logout } = useAuth();
  const pathname = usePathname();
  const toast = useToast();
  const [aceptadoPor, setAceptadoPor] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // El dato viene en `/auth/me`. Al iniciar sesión (login, Google, alta) el
  // usuario llega embebido en la respuesta de los tokens, sin ese campo: sin
  // esta consulta el cartel recién aparecía al recargar la app.
  const [consultado, setConsultado] = useState<{ id: string; requerido: boolean } | null>(null);
  const userId = user?.id ?? null;
  const sinDato = user !== null && user.terms_acceptance_required === undefined;
  useEffect(() => {
    if (!token || !userId || !sinDato || impersonating !== null) return;
    let vigente = true;
    api
      .get<{ terms_acceptance_required?: boolean }>("/auth/me", token)
      .then((me) => {
        if (vigente) setConsultado({ id: userId, requerido: Boolean(me.terms_acceptance_required) });
      })
      // Si falla, no se pide nada ahora: se vuelve a mirar al abrir la app.
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [token, userId, sinDato, impersonating]);
  const requerido =
    user?.terms_acceptance_required ?? (consultado?.id === userId ? consultado.requerido : false);

  const pendiente =
    requerido &&
    !user?.two_factor_setup_required &&
    aceptadoPor !== user?.id &&
    impersonating === null &&
    !LEGALES.includes(pathname);

  // Mientras el cartel está, el recorrido guiado espera (`GuidedTour`): si no,
  // quedaba encima y tapaba «Acepto».
  useEffect(() => {
    if (!pendiente) return;
    document.body.setAttribute("data-terminos-pendientes", "");
    return () => document.body.removeAttribute("data-terminos-pendientes");
  }, [pendiente]);

  async function aceptar() {
    if (!token || !user) return;
    setGuardando(true);
    try {
      await api.post("/auth/terms/accept", undefined, token);
      setAceptadoPor(user.id);
    } catch (err) {
      toast(getErrorMessage(err, "No pudimos guardar tu respuesta. Probá de nuevo."), "error");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open={pendiente} onClose={() => {}} title="Actualizamos los Términos">
      <p className="text-sm text-ink-soft">
        Cambiamos los{" "}
        <Link href="/terminos" className="font-semibold text-primary-text underline">
          Términos y Condiciones
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" className="font-semibold text-primary-text underline">
          Política de Privacidad
        </Link>
        . Para seguir usando Oído necesitamos que los aceptes.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Button fullWidth onClick={() => void aceptar()} loading={guardando}>
          Acepto
        </Button>
        <Button fullWidth variant="surface" onClick={() => void logout()} disabled={guardando}>
          Cerrar sesión
        </Button>
      </div>
    </Modal>
  );
}
