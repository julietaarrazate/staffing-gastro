"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SparklesIcon } from "@/components/icons";

/**
 * Cápsula flotante del asistente, disponible en toda la app del comercio
 * (pedido de Julieta: separado del wizard, "un botón afuera"). Navega a
 * `/assistant` — la pantalla dedicada del asistente (pedido de Julieta: "que
 * no sea un botón escondido, que tenga su lugar para pedirle"), no una hoja
 * que se abre encima.
 *
 * En `/shifts` (panel/home del comercio) se oculta: ahí vive `AIAssistantBar`,
 * la versión prominente inline — tener las dos juntas en la misma pantalla
 * duplica el mismo punto de entrada. En `/assistant` también se oculta —
 * no tiene sentido flotar un botón hacia la pantalla en la que ya estás.
 *
 * Se oculta también en /shifts/new y /shifts/new-event, que ya tienen su
 * propio cuadro de texto+dictado integrado, y en /bienvenida — el onboarding
 * recién arrancado no es el momento de ofrecer el asistente (Julieta:
 * "tiene que estar fuera del onboarding inicial, ya cuando estás adentro
 * podés usarla, si no está ese botón ahí flotando y queda raro").
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
    pathname === "/assistant";
  if (user?.role !== "employer" || hiddenOnThisPage) return null;

  return (
    <button
      type="button"
      onClick={() => router.push("/assistant")}
      aria-label="Asistente de turnos con IA"
      className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[var(--shadow-float)] transition active:scale-95 md:bottom-6 md:right-6"
    >
      <SparklesIcon size={22} />
    </button>
  );
}
