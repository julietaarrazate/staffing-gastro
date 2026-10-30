/**
 * El plan que el comercio eligió en los precios de la landing ("Empezar con
 * Básico", pedido de Julieta del 2026-10-30). Viaja como `?plan=<code>` a
 * `/register`; al crear la cuenta de comercio se guarda acá, y cuando termina
 * el onboarding de `/bienvenida` va a "Mi plan" (`/subscription?plan=<code>`)
 * con ese plan resaltado, en vez de al panel. Ahí se borra.
 *
 * `sessionStorage` y no `localStorage`: vale para esta pestaña y este alta.
 * Cada acceso va con try/catch porque en modo privado o con el almacenamiento
 * bloqueado puede tirar; sin almacenamiento el alta sigue igual que siempre.
 */

/** Los códigos de `backend/app/modules/subscription/domain/plans.py` (y de
 *  `components/landing/planes.ts`, que un test compara con éstos). */
export const PLANES_CONOCIDOS = ["inicial", "basico", "pro"] as const;
export type PlanConocido = (typeof PLANES_CONOCIDOS)[number];

const CLAVE = "staffya_plan_elegido";

/** El código si es uno de los planes conocidos; si no, `null`. */
export function planValido(valor: string | null | undefined): PlanConocido | null {
  const limpio = valor?.trim().toLowerCase();
  return PLANES_CONOCIDOS.find((code) => code === limpio) ?? null;
}

/** El alta de comercio con el plan ya elegido (botones de los precios). */
export function urlAltaConPlan(plan: PlanConocido): string {
  return `/register?rol=comercio&plan=${plan}`;
}

/** "Mi plan" con ese plan resaltado. */
export function urlMiPlan(plan: PlanConocido): string {
  return `/subscription?plan=${plan}`;
}

export function guardarPlanElegido(plan: PlanConocido): void {
  try {
    window.sessionStorage.setItem(CLAVE, plan);
  } catch {
    // Sin almacenamiento: termina en el panel, como cualquier alta.
  }
}

export function leerPlanElegido(): PlanConocido | null {
  try {
    return planValido(window.sessionStorage.getItem(CLAVE));
  } catch {
    return null;
  }
}

export function borrarPlanElegido(): void {
  try {
    window.sessionStorage.removeItem(CLAVE);
  } catch {
    // No hay nada que borrar.
  }
}

/**
 * Adónde va el comercio al terminar `/bienvenida`: a "Mi plan" con el plan
 * que eligió en la landing (y lo guardado se borra, para que no vuelva a
 * pasar), o a `porDefecto` si no eligió ninguno.
 */
export function destinoTrasBienvenida(porDefecto: string): string {
  const plan = leerPlanElegido();
  if (!plan) return porDefecto;
  borrarPlanElegido();
  return urlMiPlan(plan);
}
