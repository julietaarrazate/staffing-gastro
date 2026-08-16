"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogoGlyph } from "@/components/Logo";

/**
 * Cápsula flotante del asistente, disponible en toda la app (comercio Y
 * trabajador — pedido de Julieta: "el asistente de ia falta para el
 * trabajador"; separado del wizard, "un botón afuera"). Navega a
 * `/assistant` — la pantalla dedicada del asistente (pedido de Julieta: "que
 * no sea un botón escondido, que tenga su lugar para pedirle"), no una hoja
 * que se abre encima. La pantalla rama internamente por rol (ver
 * `app/assistant/page.tsx`) — el trabajador busca turnos, el comercio hace
 * de todo un poco (crear/consultar turnos, candidatos, verificación).
 *
 * En `/shifts` (panel/home del comercio) y, desde 2026-08-16, en `/feed`
 * (Inicio del trabajador) se oculta: ambas pantallas ya tienen
 * `AIAssistantBar`, la versión prominente inline — tener las dos juntas en la
 * misma pantalla duplica el mismo punto de entrada. Julieta pidió
 * explícitamente sacar la cápsula flotante y que el trabajador tenga "un
 * lugar arriba" como ya tiene el comercio, no un botón suelto tapando el
 * mazo. En `/assistant` también se oculta, para cualquier rol — no tiene
 * sentido flotar un botón hacia la pantalla en la que ya estás.
 *
 * Se oculta también en /shifts/new y /shifts/new-event, que ya tienen su
 * propio cuadro de texto+dictado integrado, y en /bienvenida — el onboarding
 * recién arrancado no es el momento de ofrecer el asistente (Julieta:
 * "tiene que estar fuera del onboarding inicial, ya cuando estás adentro
 * podés usarla, si no está ese botón ahí flotando y queda raro").
 *
 * Ícono: el glifo de la marca (`LogoGlyph`), no un genérico de "IA" tipo
 * estrellita (reporte real de Julieta: "la IA tiene ese ícono genérico") —
 * mismo criterio en `AIAssistantBar` y `/assistant`, un solo punto de
 * identidad visual para el asistente en toda la app.
 */
export default function AIAssistantFab() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const hiddenOnThisPage =
    pathname === "/shifts" ||
    pathname === "/shifts/new" ||
    pathname === "/shifts/new-event" ||
    pathname === "/bienvenida" ||
    pathname === "/assistant" ||
    pathname === "/feed";
  if (!user || user.role === "admin" || hiddenOnThisPage) return null;

  return (
    <button
      type="button"
      onClick={() => router.push("/assistant")}
      aria-label="Asistente de turnos con IA"
      className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[var(--shadow-float)] transition active:scale-95 md:bottom-6 md:right-6"
    >
      <LogoGlyph size={22} color="#fff" />
    </button>
  );
}
