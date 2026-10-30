// Verificación en dos pasos de la cuenta admin (ADR-0023): tipos, llamadas a
// la API y lo que se puede probar sin pantalla. El backend decide todo; acá
// sólo se habla con `/auth/2fa/*`.

import { api } from "@/lib/api";
import type { User } from "@/lib/types";

/** Pantalla del alta y de los ajustes de la verificación. */
export const TWO_FACTOR_PAGE = "/admin/seguridad";

/** Códigos de `detail.code` que manda el backend. */
export const TWO_FACTOR_CODES = {
  setupRequired: "two_factor_setup_required",
  verificationRequired: "two_factor_required",
  challengeInvalid: "two_factor_challenge_invalid",
  notConfigured: "two_factor_not_configured",
} as const;

export type TwoFactorStatus = {
  enabled: boolean;
  enabled_at: string | null;
  recovery_codes_left: number;
};

export type TwoFactorSetup = { secret: string; otpauth_uri: string };

/** Respuesta de `/auth/login` o `/auth/google` cuando falta el código. */
export type TwoFactorChallenge = {
  two_factor_required: true;
  challenge_token: string;
  expires_in: number;
};

export type SessionTokens = { access_token: string; user?: User };

export type TwoFactorVerified = SessionTokens & {
  used_recovery_code: boolean;
  recovery_codes_left: number;
};

export type TwoFactorConfirmed = SessionTokens & { recovery_codes: string[] };

export function isTwoFactorChallenge(body: unknown): body is TwoFactorChallenge {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { two_factor_required?: unknown }).two_factor_required === true &&
    typeof (body as { challenge_token?: unknown }).challenge_token === "string"
  );
}

export const twoFactorApi = {
  status: (token: string) => api.get<TwoFactorStatus>("/auth/2fa", token),
  /** `code` sólo para cambiar de celular (con la verificación ya activa). */
  setup: (token: string, code?: string) =>
    api.post<TwoFactorSetup>("/auth/2fa/setup", code ? { code } : {}, token),
  confirm: (token: string, code: string) =>
    api.post<TwoFactorConfirmed>("/auth/2fa/confirm", { code }, token),
  regenerateCodes: (token: string, code: string) =>
    api.post<{ recovery_codes: string[] }>("/auth/2fa/recovery-codes", { code }, token),
  verify: (challengeToken: string, code: string) =>
    api.post<TwoFactorVerified>("/auth/2fa/verify", {
      challenge_token: challengeToken,
      code,
    }),
};

/** El secreto en grupos de 4, para copiarlo a mano sin perderse. */
export function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/** Lo que se tipea en el campo del código de la app: sólo dígitos, hasta 6. */
export function sanitizeAppCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

/** ¿Alcanza para mandar? 6 dígitos de la app, o un código de recuperación
 * (12 letras y números, con o sin guiones). */
export function isCompleteCode(raw: string, mode: "app" | "recovery"): boolean {
  if (mode === "app") return /^\d{6}$/.test(raw);
  return raw.replace(/[^0-9a-z]/gi, "").length === 12;
}

/** Contenido del .txt que se descarga con los códigos de recuperación. */
export function recoveryCodesText(codes: string[], email: string, generatedAt: Date): string {
  const date = generatedAt.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  return [
    "Oído — códigos de recuperación de la verificación en dos pasos",
    `Cuenta: ${email}`,
    `Generados el ${date}`,
    "",
    "Cada código sirve una sola vez. Usalos si no tenés el celular a mano.",
    "Guardalos en un lugar seguro, fuera del celular.",
    "",
    ...codes,
    "",
  ].join("\n");
}
