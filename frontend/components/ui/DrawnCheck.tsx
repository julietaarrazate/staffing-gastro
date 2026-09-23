"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Check que se dibuja: primero el círculo, después el tilde. Es la
 * confirmación de las acciones que importan (postularse, asignar), no un
 * adorno — por eso sólo se anima cuando `animate` es true, es decir cuando
 * la acción acaba de pasar en esta pantalla. Si ya estaba hecha al cargar,
 * se muestra quieto: festejar algo viejo en cada visita cansa.
 *
 * Con "reducir movimiento" del sistema también aparece quieto.
 */
export default function DrawnCheck({
  size = 22,
  animate = false,
  className = "",
}: {
  size?: number;
  animate?: boolean;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const draw = animate && !reducedMotion;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        initial={draw ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
      />
      <motion.path
        d="m8.5 12.5 2.5 2.5 5-5.5"
        initial={draw ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.22, ease: "easeOut", delay: draw ? 0.24 : 0 }}
      />
    </svg>
  );
}
