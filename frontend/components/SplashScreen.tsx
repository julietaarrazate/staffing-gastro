"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Spinner from "@/components/ui/Spinner";
import Filete from "@/components/landing/Filete";
import { MOTION_BRAND, MOTION_UI } from "@/lib/motion";

// Tiempo mínimo en pantalla: deja que termine la coreografía de entrada (el
// filete que aparece + el tagline) sin que se sienta un corte brusco.
const MIN_VISIBLE_MS = 1100;
// Red de seguridad: pasado este tiempo la splash se va sí o sí, para que un
// backend frío (Render free tier) nunca deje el logo "trabado" en pantalla.
const MAX_VISIBLE_MS = 6000;

/**
 * Pantalla de bienvenida de marca (2026-10-19): el "oído" fileteado grande,
 * el mismo del final de la landing y de la miniatura, sobre el cielo (en
 * oscuro, la noche azul), con el tagline. Se muestra una vez por sesión al
 * abrir la app, también antes de la landing: Julieta la quiere como "un
 * inicio previo a la lectura de la landing". Hasta ese día era el fondo
 * naranja con el isotipo, que queda sólo como ícono de la app hasta que haya
 * uno nuevo.
 *
 * Se queda visible mientras dura la coreografía de entrada Y la sesión
 * todavía se está verificando (`useAuth().loading`) — pero nunca más de
 * `MAX_VISIBLE_MS`, así que un backend lento no la deja pegada. Si la
 * verificación se extiende más allá de la entrada de marca, la pantalla pasa
 * a un estado "verificando" (logo chico + spinner) en vez de dejar el logo
 * grande congelado en su pose final.
 */
export default function SplashScreen() {
  const [show, setShow] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const reducedMotion = useReducedMotion();
  const { loading } = useAuth();

  useEffect(() => {
    if (sessionStorage.getItem("staffya_splash_seen")) return;
    sessionStorage.setItem("staffya_splash_seen", "1");

    let minTimer: ReturnType<typeof setTimeout> | undefined;
    let maxTimer: ReturnType<typeof setTimeout> | undefined;

    async function begin() {
      setShow(true);
      minTimer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
      maxTimer = setTimeout(() => setShow(false), MAX_VISIBLE_MS);
    }
    begin();

    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, []);

  // Una vez que pasó el mínimo de la coreografía, se va apenas la sesión
  // termina de verificarse (no hace falta esperar el tope de seguridad).
  useEffect(() => {
    async function maybeHide() {
      if (minElapsed && !loading) setShow(false);
    }
    maybeHide();
  }, [minElapsed, loading]);

  const verifying = show && minElapsed && loading;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: reducedMotion ? 1 : 1.08 }}
          transition={reducedMotion ? { duration: 0 } : MOTION_BRAND}
          className="splash-cielo fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden px-4"
        >
          {/* El filete entra apenas agrandándose; el nombre accesible va en
              el h1 (el SVG es decorativo). */}
          <motion.h1
            initial={reducedMotion ? false : { scale: 0.86, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 18, delay: 0.05 }}
            className="relative w-full max-w-[560px]"
          >
            <span className="sr-only">oído</span>
            <Filete palabra="oído" tam="firma" className="block h-auto w-full" />
          </motion.h1>
          <motion.p
            initial={reducedMotion ? false : { y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { ...MOTION_BRAND, delay: 0.45 }}
            className="relative mt-2 text-base font-semibold text-ink"
          >
            Personal gastronómico, <span className="splash-ya">ya.</span>
          </motion.p>

          {/* Estado "verificando": reemplaza los anillos infinitos por un
              loader claro con texto, para que un backend lento se sienta
              "cargando" en vez de "trabado". */}
          {verifying && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...MOTION_UI, delay: 0.2 }}
              className="relative mt-8 flex items-center gap-2 text-sm font-medium text-ink-soft"
            >
              <Spinner size={16} />
              Verificando tu sesión…
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
