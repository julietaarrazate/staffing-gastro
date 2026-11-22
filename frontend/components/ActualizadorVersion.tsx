"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  VERSION_LOCAL,
  debeRecargar,
  leerRecargadoPor,
  marcarRecargadoPor,
  pedirVersionRemota,
} from "@/lib/version-app";

const CADA_MS = 10 * 60 * 1000;
/** Fuera de primer plano más que esto, al volver se recarga en el acto: es la
 * app que quedó abierta días. Elegir un archivo o sacar una foto lleva menos,
 * y ahí no se recarga (se perdería el formulario o la subida). */
const AUSENCIA_LARGA_MS = 15 * 60 * 1000;

/** Sin UI. Compara la versión del bundle con la servida (`/version.json`) al
 * montar, al volver a primer plano y cada ~10 min. Si hay una nueva:
 * - al montar (carga fresca, no hay nada que perder), recarga ya;
 * - si la app estuvo fuera de primer plano un buen rato, recarga al volver;
 * - si no, espera al próximo cambio de pantalla y recarga ahí, así nunca
 *   corta lo que la persona está haciendo.
 * A lo sumo una recarga por versión (anti-loop en sessionStorage). También le
 * pide al service worker que busque una versión nueva. */
export default function ActualizadorVersion() {
  const pathname = usePathname();
  const pendiente = useRef<string | null>(null);
  const primeraRuta = useRef(true);

  function recargar(version: string) {
    if (marcarRecargadoPor(version)) window.location.reload();
  }

  // Cambio de pantalla con una versión nueva pendiente: recarga en la ruta nueva.
  useEffect(() => {
    if (primeraRuta.current) {
      primeraRuta.current = false;
      return;
    }
    if (pendiente.current) recargar(pendiente.current);
  }, [pathname]);

  useEffect(() => {
    if (!VERSION_LOCAL) return;
    let chequeando = false;
    let ocultaDesde: number | null = null;

    async function chequear(recargarYa: boolean) {
      if (chequeando) return;
      chequeando = true;
      try {
        const remota = await pedirVersionRemota();
        if (!remota || !debeRecargar({ local: VERSION_LOCAL, remota, yaRecargadoPor: leerRecargadoPor() })) {
          return;
        }
        if (recargarYa) recargar(remota);
        else pendiente.current = remota;
      } finally {
        chequeando = false;
      }
    }

    function alCambiarVisibilidad() {
      if (document.visibilityState !== "visible") {
        ocultaDesde = Date.now();
        return;
      }
      const ausenciaLarga = ocultaDesde !== null && Date.now() - ocultaDesde >= AUSENCIA_LARGA_MS;
      ocultaDesde = null;
      void chequear(ausenciaLarga);
      navigator.serviceWorker
        ?.getRegistration("/sw.js")
        .then((r) => r?.update())
        .catch(() => {});
    }

    void chequear(true);
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    const t = setInterval(() => void chequear(false), CADA_MS);
    return () => {
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      clearInterval(t);
    };
  }, []);

  return null;
}
