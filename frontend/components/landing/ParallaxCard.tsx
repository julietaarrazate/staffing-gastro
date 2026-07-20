"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import type { ReactNode } from "react";

/**
 * Micro-parallax sutil: el hijo se eleva unos pocos px al scrollear, a la
 * velocidad que indique `range` (distinta por tarjeta para que el bento se
 * sienta con profundidad, no como un solo bloque). Nada de "efecto feria":
 * son pocos píxeles, no grados de rotación ni escalas grandes.
 */
export default function ParallaxCard({
  children,
  range = 14,
  className,
}: {
  children: ReactNode;
  /** Desplazamiento máximo en px (± range/2 aprox.) a lo largo del scroll. */
  range?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [range / 2, -range / 2]);

  return (
    <motion.div ref={ref} style={reducedMotion ? undefined : { y }} className={className}>
      {children}
    </motion.div>
  );
}
