"use client";

import { useEffect, useState } from "react";
import type { Shift, ShiftStatus } from "@/lib/types";
import { storyShift, withToday } from "./fixtures";

/**
 * El turno de la historia en un estado dado. En el servidor y en el primer
 * render lleva una fecha fija (mismo HTML en los dos lados); después de montar
 * pasa a "hoy a las 21", que es lo que tiene que leer el visitante.
 */
export function useStoryShift(status: ShiftStatus, overrides: Partial<Shift> = {}): Shift {
  const [today, setToday] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setToday(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const base = storyShift(status, overrides);
  return today ? withToday(base) : base;
}
