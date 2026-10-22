import type { SubscriptionPlan } from "@/lib/types";

/** Copia literal de backend/app/modules/subscription/domain/plans.py. La
 *  usan los precios mientras no contesta la API. */
export const RESPALDO: SubscriptionPlan[] = [
  { code: "inicial", name: "Inicial", price_ars: 9900, max_turnos_mes: 5, features: ["Hasta 5 turnos publicados por mes", "Soporte por email"] },
  { code: "basico", name: "Básico", price_ars: 20000, max_turnos_mes: 15, features: ["Hasta 15 turnos publicados por mes", "Soporte prioritario"] },
  {
    code: "pro",
    name: "Pro",
    price_ars: 45000,
    max_turnos_mes: null,
    features: ["Turnos publicados ilimitados", "Soporte prioritario", "Destacado en el feed"],
  },
];
