"use client";

import { motion } from "motion/react";
import DrawnCheck from "./DrawnCheck";

/**
 * Tapa una tarjeta con la confirmación de lo que se acaba de hacer (check
 * que se dibuja + una palabra) un instante antes de que la pantalla siga:
 * la tarjeta recién postulada del mapa antes de salir de la lista, el
 * postulante recién asignado antes de volver al panel. Sin esto, la
 * tarjeta desaparecía en seco y el único rastro de "salió bien" era un
 * toast.
 *
 * El padre tiene que ser `relative` y llevar su propio radio (el overlay
 * lo hereda). Base `bg-card` + velo verde encima: en oscuro el tinte es
 * translúcido y, solo, dejaría ver el contenido de abajo.
 */
export default function ConfirmOverlay({ label, detail }: { label: string; detail?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-0 z-10 overflow-hidden rounded-[inherit] bg-card"
      role="status"
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-success-tint">
        <DrawnCheck size={40} animate className="text-success-text" />
        <p className="text-[15px] font-semibold text-ink">{label}</p>
        {detail && <p className="-mt-1.5 max-w-[90%] truncate text-sm text-ink/60">{detail}</p>}
      </div>
    </motion.div>
  );
}
