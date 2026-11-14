// Qué le mostramos a la persona en el interruptor de avisos (Ajustes).
// Lógica pura: `PushToggle` la alimenta con lo que lee del navegador.
//
// Regla: nunca un interruptor que no hace nada. Si activar no puede funcionar,
// la fila no es un botón y dice por qué y qué hacer.

import type { Plataforma } from "@/lib/instalar";

export type EstadoPush =
  /** El navegador deja activar: la fila es un interruptor. */
  | "interruptor"
  /** El permiso está bloqueado en el navegador: sólo se arregla desde sus ajustes. */
  | "bloqueado"
  /** iPhone sin la app instalada: Safari no tiene avisos hasta instalarla. */
  | "instalar"
  /** Sin soporte y sin nada que la persona pueda hacer: no se muestra. */
  | "oculto";

export interface EntradaEstadoPush {
  soportado: boolean;
  /** `Notification.permission`, o `null` si el navegador no lo tiene. */
  permiso: NotificationPermission | null;
  plataforma: Plataforma | null;
  instalada: boolean;
}

export function estadoDePush({
  soportado,
  permiso,
  plataforma,
  instalada,
}: EntradaEstadoPush): EstadoPush {
  if (!soportado)
    return plataforma === "iphone" && !instalada ? "instalar" : "oculto";
  return permiso === "denied" ? "bloqueado" : "interruptor";
}

/** Cómo desbloquear los avisos, según dónde esté abierta la app. */
export function comoDesbloquear(
  plataforma: Plataforma | null,
  instalada: boolean,
): string {
  if (plataforma === "iphone") {
    return "Abrí Ajustes del iPhone, entrá a Notificaciones, tocá Oído y permitilas.";
  }
  if (plataforma === "android" && instalada) {
    return "Mantené apretado el ícono de Oído, tocá Información de la app, entrá a Notificaciones y permitilas.";
  }
  return "Tocá el candado al lado de la dirección, entrá a Configuración del sitio y poné Notificaciones en «Permitir».";
}
