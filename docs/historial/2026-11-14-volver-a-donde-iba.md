# Volver a donde iba: `next` por el alta, la bienvenida y la cabecera (G16, U062)

**Pedido:** salida a beta, hallazgo U062: quien llega por un link (un turno compartido, por ejemplo) y tiene que ingresar o registrarse terminaba en la home en vez de en lo que iba a ver.

**Qué cambió:** abrir `/turno/<id>` sin sesión, tocar «Postulate en Oído», registrarse y terminar la bienvenida deja a la persona en ese turno. Lo mismo con «Ingresá» (nuevo en el turno público: «¿Ya tenés cuenta? Ingresá»). `next` viaja por `/register` (mail y Google), `/bienvenida` (trabajador y comercio; si el comercio había elegido un plan en la landing, el plan sigue ganando), los links «Creá una» / «Ingresá» entre ingreso y alta, la cabecera (en cualquier pantalla pública «Ingresar» y «Crear cuenta» vuelven a ella) y el ingreso de invitado (`/bienvenida?next=`).
- `frontend/lib/safe-next.ts`: `registerHref` y `bienvenidaHref` (con `loginHref`, los tres validan `next` con `safeNext`); `safeNext` ahora también rechaza `/register` y `/bienvenida` como destino.
- `frontend/app/register/page.tsx`, `app/bienvenida/page.tsx`, `app/login/page.tsx`, `components/ShiftDetail.tsx`, `components/Navbar.tsx` (`AuthLinks`, con `Suspense` por `useSearchParams`).
- Pruebas: `lib/safe-next.test.ts`, `components/ShiftDetail.test.tsx`, `e2e/volver-a-donde-iba.spec.ts`.

**Por qué así:** `next` viene de la dirección. Se valida con `safeNext` al leerlo de la query y de nuevo en cada helper que arma un link, nunca se muestra como texto ni se guarda. A través de `/bienvenida` viaja en la dirección y no en `sessionStorage`: no hay nada que limpiar ni que caduque. `TurnoNoDisponible` no lleva `next`: el turno ya no existe, volver ahí no sirve.

**Queda abierto:** nada de este grupo. El e2e no puede abrir `/turno/[id]` con datos (lo arma el servidor); el recorrido completo desde el turno se probó a mano contra un mock de la API (build con `NEXT_PUBLIC_API_URL` local).
