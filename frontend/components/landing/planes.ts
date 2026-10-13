import type { SubscriptionPlan } from "@/lib/types";

/** Copia literal de backend/app/modules/subscription/domain/plans.py. La
 *  usan los precios mientras no contesta la API y las preguntas frecuentes
 *  (que también van en los datos estructurados, sin JavaScript). */
export const RESPALDO: SubscriptionPlan[] = [
  { code: "gratis", name: "Gratis", price_ars: 0, max_turnos_mes: 3, features: ["Hasta 3 turnos publicados por mes", "Soporte por email"] },
  { code: "basico", name: "Básico", price_ars: 20000, max_turnos_mes: 15, features: ["Hasta 15 turnos publicados por mes", "Soporte prioritario"] },
  {
    code: "pro",
    name: "Pro",
    price_ars: 45000,
    max_turnos_mes: null,
    features: ["Turnos publicados ilimitados", "Soporte prioritario", "Destacado en el feed"],
  },
];
