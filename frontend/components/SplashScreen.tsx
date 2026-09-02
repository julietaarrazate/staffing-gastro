"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Spinner from "@/components/ui/Spinner";
import { LogoGlyph } from "@/components/Logo";
import { MOTION_BRAND, MOTION_UI } from "@/lib/motion";

// Tiempo mínimo en pantalla: deja que termine la coreografía de entrada (pop
// del logo + título + subtítulo) sin que se sienta un corte brusco.
const MIN_VISIBLE_MS = 1100;
// Red de seguridad: pasado este tiempo la splash se va sí o sí, para que un
// backend frío (Render free tier) nunca deje el logo "trabado" en pantalla.
const MAX_VISIBLE_MS = 6000;

/**
 * Pantalla de bienvenida de marca: fondo naranja, logo que entra con un
 * "pop" + anillos pulsantes y el nombre Oído. Se muestra una vez por
 * sesión (al abrir la app).
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
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary to-primary-strong"
        >
          {/* Anillos pulsantes detrás del logo: sólo durante la coreografía de
              entrada. Si la verificación de sesión se extiende más (backend
              frío), se apagan y el logo pasa a un estado "verificando" con
              spinner en vez de quedar con animación infinita de fondo, que
              después de unos segundos se lee como colgada. */}
          {!reducedMotion &&
            !verifying &&
            [0, 0.4, 0.8].map((delay) => (
              <motion.span
                key={delay}
                initial={{ scale: 0.6, opacity: 0.5 }}
                animate={{ scale: 2.6, opacity: 0 }}
                transition={{ duration: 1.8, delay, repeat: Infinity, ease: "easeOut" }}
                className="absolute h-32 w-32 rounded-full border-2 border-white/40"
              />
            ))}

          {/* Logo */}
          <motion.div
            initial={reducedMotion ? false : { scale: 0, rotate: -25, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 14, delay: 0.1 }}
            className="relative flex h-24 w-24 items-center justify-center rounded-[28px] bg-card shadow-2xl"
          >
            <LogoGlyph size={48} color="var(--color-primary)" />
          </motion.div>

          {/* Nombre */}
          <motion.h1
            initial={reducedMotion ? false : { y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { ...MOTION_BRAND, delay: 0.35 }}
            className="relative mt-6 font-display text-5xl font-semibold tracking-tight text-white"
          >
            oído
          </motion.h1>
          <motion.p
            initial={reducedMotion ? false : { y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { ...MOTION_BRAND, delay: 0.55 }}
            className="relative mt-1 text-sm font-medium text-white"
          >
            Personal gastronómico, ya
          </motion.p>

          {/* Estado "verificando": reemplaza los anillos infinitos por un
              loader claro con texto, para que un backend lento se sienta
              "cargando" en vez de "trabado". */}
          {verifying && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...MOTION_UI, delay: 0.2 }}
              className="relative mt-8 flex items-center gap-2 text-sm font-medium text-white"
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
