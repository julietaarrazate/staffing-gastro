# Perfiles, fichas públicas, Editar perfil y Ajustes en la compu

**Pedido:** Julieta, 2026-11-24: optimizar todo el sistema para web y mobile (renglones 7, 13 y 15 de
`docs/planning/ESCRITORIO_PANTALLAS.md`).

**Qué se miró (1440 px, claro y oscuro, con datos realistas):**

- **Perfil del comercio y de quien trabaja** (`/profile`), y las **fichas públicas** (`/companies/[id]`,
  `/workers/[id]`): ya iban en dos columnas dentro del marco de 1024 px (reputación, reseñas y
  verificación a un lado; datos, accesos y mapa al otro). No se tocaron; se les agregó la prueba de
  disposición.
- **Editar perfil / Datos del comercio y Ajustes** (`/profile/edit`, `/profile/settings`): eran una columna
  de 576 px. Ahora miden 640 px en la compu, centrados, con la prop `formulario` de `SubpaginaSuave`
  (`frontend/components/profile/ProfileParts.tsx`), pasada sólo desde esas dos pantallas (Favoritos,
  Soporte y Mi plan, que usan la misma cáscara, no cambian).

**Por qué así:** no se pasó a dos columnas el formulario (es una sola tarea, de arriba abajo); sí se le dio
el ancho de lectura. El celular no cambia: comparado píxel a píxel a 390 px, sólo difieren las nubes
animadas. No cambia qué datos se ven ni a quién.

**Pruebas:** disposición a 1440 y vuelta a 390 en `e2e/perfil-suave.spec.ts`, `e2e/perfil-comercio-suave.spec.ts`,
`e2e/fichas-suaves.spec.ts` y `e2e/editar-perfil-suave.spec.ts`.

**Queda abierto:** nada de esta tanda.
