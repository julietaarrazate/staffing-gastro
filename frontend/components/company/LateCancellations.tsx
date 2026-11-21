"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { CompanyProfile } from "@/lib/types";

/**
 * Cancelaciones tardías del comercio, en su propio perfil (`/profile`).
 *
 * Una cancelación tardía es cancelar un turno con el trabajador ya confirmado
 * (ADR-0007); la confirmación de «Cancelar turno» lo avisa antes y acá queda
 * la cuenta. Sale de `GET /companies/me/profile`, el perfil del que mira: no
 * se le muestra a nadie más.
 *
 * En cero no dibuja nada, igual que el resto del perfil (sobrecarga visual,
 * 2026-09-30): no se le cuenta a un comercio nuevo lo que no tiene. Sin
 * perfil de comercio todavía (404) o sin red, tampoco.
 */
export default function LateCancellations({
  count: conocida,
  suave = false,
}: {
  /** La cuenta, si quien lo dibuja ya leyó el perfil: no se vuelve a pedir. */
  count?: number;
  /** Con la dirección suave: una caja con el relleno del campo, sin filete. */
  suave?: boolean;
} = {}) {
  const { token } = useAuth();
  const [leida, setCount] = useState(0);
  const count = conocida ?? leida;

  useEffect(() => {
    if (!token || conocida !== undefined) return;
    let cancelled = false;
    api
      .get<CompanyProfile>("/companies/me/profile", token)
      .then((profile) => {
        if (!cancelled) setCount(profile.late_cancellations ?? 0);
      })
      .catch(() => {
        // Es un dato de contexto: si no se pudo leer, el perfil se ve igual.
      });
    return () => {
      cancelled = true;
    };
  }, [token, conocida]);

  if (count <= 0) return null;

  return (
    <section
      aria-label="Cancelaciones tardías"
      className={
        suave
          ? "caja-suave flex items-center gap-4 px-5 py-4"
          : "mt-4 flex items-center gap-4 rounded-[var(--radius-card)] bg-card px-5 py-4 shadow-[var(--shadow-soft)] ring-1 ring-line"
      }
    >
      <p className="shrink-0 text-2xl font-extrabold tabular-nums text-ink">{count}</p>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">
          {count === 1 ? "Cancelación tardía" : "Cancelaciones tardías"}
        </p>
        <p className={suave ? "text-caption text-ink-soft" : "text-xs text-ink/50"}>
          Turnos que cancelaste con el trabajador ya confirmado.
        </p>
      </div>
    </section>
  );
}
