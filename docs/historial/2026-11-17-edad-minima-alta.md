# Fecha de nacimiento en el alta y nadie menor de 18 (U101)

**Pedido:** Julieta, 2026-11-17 (etapa 3 de la beta, decisión sobre U101):
pedir la fecha de nacimiento y bloquear a menores de 18 en el alta. Los
términos y la privacidad ya decían «mayores de 18» y «pedimos la fecha de
nacimiento», pero nadie la pedía.

**Qué cambió:**

- `/register` pide «Fecha de nacimiento» debajo del nombre, con la línea
  «Oído es para mayores de 18 años. No se la mostramos a nadie.». Con la
  fecha completa y de un menor, el campo lo dice y el botón queda con el
  motivo («Oído es sólo para mayores de 18 años.»), igual que el resto de
  lo que falta (U041). El selector no deja elegir una fecha posterior a
  «cumplir 18 hoy».
- Google: desde `/register` usa la fecha del formulario; desde `/login`, el
  paso «¿Buscás trabajo o buscás personal?» suma el mismo campo y los dos
  botones esperan la fecha y la casilla.
- Backend: `users.birth_date` (migración 0048, nula en las cuentas que ya
  existían y en las internas). Regla pura en
  `identity/domain/edad.py` (`validar_fecha_nacimiento`, con `hoy_art()`):
  sin fecha, fecha futura o de hace más de cien años, o menor de 18 → 422 con
  un texto claro, y la cuenta no se crea. Se exige en toda alta pública
  (la que acepta términos: `/auth/register` y `/auth/google` con rol); el
  seed y las invitadas no la piden. La fecha no sale en ninguna respuesta.
- Legales: `/terminos` («Tu cuenta») y `/privacidad` («Para todos»: fecha
  de nacimiento, sólo para confirmar la edad, no la ve nadie; «Menores de
  edad») dicen lo que pasa ahora. `LEGAL_TERMS_VERSION` pasa a
  `2026-11-17-2` en los dos lados.
- Frontend: `lib/edad.ts` espeja la regla (hoy en hora argentina, 29 de
  febrero), `motivoBloqueoRegistro` suma la fecha, `TextField` acepta
  `min`/`max` de fecha.

**Por qué así:** la fecha va en la cuenta (identidad) y no en el perfil del
trabajador porque la regla es para los dos roles y el perfil se crea
después del alta. `WorkerProfile.birth_date` (de antes, ninguna pantalla lo
carga) no se toca: copiarla ahí haría pública la edad en `/workers/[id]`,
que es una regla de privacidad nueva. Es declarada, no verificada contra el
DNI (`docs/TRUST_SYSTEM.md`, `mayoria_de_edad`).

**Queda abierto:**

- Las cuentas creadas antes no tienen fecha. No se les pide (la decisión
  dice «en el alta»); si Julieta quiere pedírsela a todas, es otro cambio.
- Lo legal se le pregunta a Julieta antes del merge.
