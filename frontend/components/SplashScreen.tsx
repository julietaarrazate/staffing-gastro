"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Pantalla de bienvenida de marca: fondo naranja, logo que entra con un
 * "pop" + anillos pulsantes y el nombre Staffya. Se muestra una vez por
 * sesión (al abrir la app) y se desvanece sola.
 */
export default function SplashScreen() {
  const [show, setShow] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (sessionStorage.getItem("staffya_splash_seen")) return;
    sessionStorage.setItem("staffya_splash_seen", "1");
    setShow(true);
    const t = setTimeout(() => setShow(false), 1900);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: reducedMotion ? 1 : 1.08 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-orange-500 to-red-600"
        >
          {/* Anillos pulsantes detrás del logo: animación repeat:Infinity, la
              que más se nota con "reducir movimiento" activado — se omiten
              directamente en vez de sólo acortar la transición. */}
          {!reducedMotion &&
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
            className="relative flex h-24 w-24 items-center justify-center rounded-[28px] bg-white shadow-2xl"
          >
            <svg width={48} height={48} viewBox="0 0 512 512" fill="none" aria-hidden>
              <defs>
                <linearGradient id="splashGrad" x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f97316" />
                  <stop offset="1" stopColor="#ea580c" />
                </linearGradient>
              </defs>
              <path d="M294 44 L136 287 H233 L202 468 L376 202 H266 Z" fill="url(#splashGrad)" />
            </svg>
          </motion.div>

          {/* Nombre */}
          <motion.h1
            initial={reducedMotion ? false : { y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { delay: 0.35, duration: 0.5 }}
            className="relative mt-6 text-4xl font-extrabold tracking-tight text-white"
          >
            Staff<span className="text-orange-200">ya</span>
          </motion.h1>
          <motion.p
            initial={reducedMotion ? false : { y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { delay: 0.55, duration: 0.5 }}
            className="relative mt-1 text-sm font-medium text-orange-50"
          >
            Tu próximo turno, en minutos
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
