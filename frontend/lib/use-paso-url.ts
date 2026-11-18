"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * El paso de un asistente por nombre (`?paso=oficio`), para que «Atrás» del
 * navegador vuelva al paso anterior. Conserva los demás parámetros (`?next=`).
 *
 * `completos[i]` dice si el paso `i` ya tiene lo que necesita para pasar al
 * siguiente: una dirección abierta en frío (recarga sin lo cargado, enlace
 * viejo) no saltea pasos incompletos, vuelve al primero que falta.
 *
 * Tiene que usarse dentro de un `Suspense` (lee `useSearchParams`).
 */
export function usePasoUrl<T extends string>(pasos: readonly T[], completos: boolean[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Pasos que dejamos en el historial: «Volver» de la pantalla usa el
  // historial si el paso anterior es el de arriba, para no hacer un bucle.
  const pila = useRef<T[]>([]);

  const raw = searchParams.get("paso");
  const pedido = pasos.findIndex((p) => p === raw);
  let permitido = 0;
  while (permitido < pasos.length - 1 && completos[permitido]) permitido++;
  const indice = Math.min(Math.max(pedido, 0), permitido);
  const paso = pasos[indice];

  // Una dirección que pide más de lo permitido (o un paso inventado) se
  // corrige sin sumar una entrada al historial.
  const corregir = raw !== null && raw !== paso;
  useEffect(() => {
    if (!corregir) return;
    router.replace(urlCon(pathname, searchParams, indice === 0 ? null : paso), { scroll: false });
  }, [corregir, router, pathname, searchParams, indice, paso]);

  function irA(destino: T) {
    pila.current.push(paso);
    router.push(urlCon(pathname, searchParams, pasos[0] === destino ? null : destino), {
      scroll: false,
    });
  }

  function volverA(destino: T) {
    if (pila.current[pila.current.length - 1] === destino) {
      pila.current.pop();
      router.back();
    } else {
      router.replace(urlCon(pathname, searchParams, pasos[0] === destino ? null : destino), {
        scroll: false,
      });
    }
  }

  return { paso, irA, volverA };
}

function urlCon(pathname: string, actuales: URLSearchParams, paso: string | null): string {
  const params = new URLSearchParams(actuales.toString());
  if (paso === null) params.delete("paso");
  else params.set("paso", paso);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
