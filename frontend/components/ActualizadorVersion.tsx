"use client";

import { useEffect } from "react";
import {
  VERSION_LOCAL,
  debeRecargar,
  estaEscribiendo,
  leerRecargadoPor,
  marcarRecargadoPor,
  pedirVersionRemota,
} from "@/lib/version-app";

const CADA_MS = 10 * 60 * 1000;

/** Sin UI. Compara la versión del bundle con la servida (`/version.json`) al
 * montar, al volver a primer plano y cada ~10 min; si hay una nueva, recarga
 * la página (a lo sumo una vez por versión). Si hay un campo con foco espera
 * al próximo regreso a primer plano. También le pide al service worker que
 * busque una versión nueva. */
export default function ActualizadorVersion() {
  useEffect(() => {
    if (!VERSION_LOCAL) return;
    let pendiente = false;
    let chequeando = false;

    async function chequear() {
      if (chequeando) return;
      chequeando = true;
      try {
        const remota = await pedirVersionRemota();
        if (!debeRecargar({ local: VERSION_LOCAL, remota, yaRecargadoPor: leerRecargadoPor() })) {
          pendiente = false;
          return;
        }
        if (estaEscribiendo()) {
          pendiente = true;
          return;
        }
        if (remota && marcarRecargadoPor(remota)) window.location.reload();
      } finally {
        chequeando = false;
      }
    }

    function alVolver() {
      if (document.visibilityState !== "visible") return;
      void chequear();
      navigator.serviceWorker
        ?.getRegistration("/sw.js")
        .then((r) => r?.update())
        .catch(() => {});
    }

    void chequear();
    document.addEventListener("visibilitychange", alVolver);
    const t = setInterval(() => {
      // Con un campo en foco, el intervalo sólo avisa; recarga al volver.
      if (!pendiente || !estaEscribiendo()) void chequear();
    }, CADA_MS);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      clearInterval(t);
    };
  }, []);

  return null;
}
