# ADR-0002 — Sesiones revocables: rotación de refresh tokens con tabla de `jti`

**Estado:** aceptado · **Fecha:** 2026-07-02

## Contexto

`app/core/security.py` emitía access tokens (15 min) y refresh tokens (30
días) como JWT puramente **stateless**: cualquier refresh token firmado con
`JWT_SECRET_KEY` era válido hasta su `exp`, sin forma de invalidarlo antes.
Consecuencia documentada como deuda crítica
([TECH_DEBT.md#S1](../TECH_DEBT.md), [SECURITY.md](../SECURITY.md#brechas-abiertas-a-cerrar--fase-de-seguridad)):

- **Sin logout server-side:** cerrar sesión en el cliente sólo borraba el
  token de `localStorage`; el token seguía siendo válido 30 días si alguien
  lo capturaba (XSS, dispositivo compartido, backup filtrado).
- **Sin rotación:** `IdentityService.refresh()` validaba el refresh token y
  emitía un par nuevo **sin invalidar el usado**. Un refresh robado convivía
  indefinidamente con el legítimo, sin señal de compromiso.
- **Sin forma de revocar en bloque** ante sospecha de robo (cambio de
  contraseña, reporte de dispositivo perdido, etc.).

El access token de 15 min ya acota el daño de un access token robado; el
problema real era el refresh de 30 días.

## Decisión

1. **Tabla `refresh_sessions`** (módulo `identity`, migración `0010`): cada
   refresh token emitido queda identificado por un claim **`jti`** (UUID v4)
   persistido junto a `user_id`, `expires_at`, `revoked_at` (nullable) y
   `created_at`. `jti` es **único e indexado**.
2. **Rotación en cada `/auth/refresh`:** se valida que el `jti` recibido
   exista y no esté revocado; si es válido, la sesión se **revoca** (queda
   inservible) y se emite + persiste un par nuevo con un `jti` nuevo. El
   cliente siempre debe usar el refresh token más reciente.
3. **Detección de reuso (posible robo):** si el `jti` recibido en
   `/auth/refresh` **ya estaba revocado** (alguien intenta reusar un refresh
   token que ya fue rotado), se interpreta como señal de que el token
   circuló fuera de control. Se revocan **todas** las sesiones activas del
   usuario (`revoke_all_for_user`) y se rechaza con 401 — fuerza un
   re-login, cortando cualquier sesión robada en paralelo.
4. **Logout server-side:** nuevo endpoint `POST /auth/logout` con body
   `{"refresh_token": "..."}`. Revoca la sesión asociada; responde `204` si
   el token era válido, `401` si no lo era (no-disclosure: mismo mensaje que
   un refresh inválido).
5. **El access token sigue siendo stateless** (JWT sin tabla de sesión): la
   ventana de exposición de 15 min se considera aceptable y evita una
   consulta a DB en cada request autenticado (costo/beneficio: revocar el
   access requeriría blacklist consultada en cada `get_current_user`, que
   hoy no se justifica). El endurecimiento se concentra en el refresh, que
   es el activo de 30 días.
6. **Capas (hexagonal):** puerto `RefreshSessionRepository` en
   `identity/domain/repositories.py`, entidad `RefreshSession` en
   `identity/domain/entities.py`, excepción de dominio
   `RefreshTokenRevokedError`. Adaptador `SqlAlchemyRefreshSessionRepository`
   + `RefreshSessionModel` en `identity/infrastructure/`. La capa `api/`
   traduce `InvalidTokenError` / `RefreshTokenRevokedError` a `401` sin
   distinguir el motivo (no-disclosure).

## Consecuencias

- ✅ Un refresh token robado deja de valer 30 días "silenciosos": en cuanto
  el dueño legítimo (o el atacante) lo usa una vez, el otro queda cortado en
  el siguiente intento, y ese intento fallido revoca todo lo demás.
- ✅ Logout real: cerrar sesión invalida el refresh token en el servidor, no
  sólo en el cliente.
- ✅ Compatible con escalado horizontal: la tabla vive en la DB compartida
  (Postgres/Neon), no en memoria del proceso.
- ⚠️ `/auth/refresh` y `/auth/logout` agregan una consulta (y a veces un
  `UPDATE`) a `refresh_sessions` — costo aceptable frente a la ganancia de
  seguridad; no afecta el access token (sigue sin tocar DB en cada request).
- ⚠️ La tabla crece con cada login/refresh y no se purga todavía; queda como
  deuda menor (job de limpieza de sesiones expiradas/revocadas, no
  bloqueante para R1).
- ⚠️ El frontend actual no llama a `/auth/logout` (borra tokens de
  `localStorage` nada más); wiring del cliente queda fuera de este ADR —
  el backend ya soporta el flujo completo cuando se conecte.
