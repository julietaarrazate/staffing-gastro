# Candidatos con la dirección «con relieve» (beta, etapa 4)

**Pedido:** Julieta, 2026-11-18: seguir con la app pantalla por pantalla
(«seguí», en la misma sesión del Inicio y el Panel). Es la tercera del orden
de `docs/design-system/direccion-relieve.md`, sobre la segunda prueba de la
app (https://claude.ai/artifact/MEN8VhUv43HM2sE9pH6kmF).

**Qué cambió:** la pantalla de Candidatos (`/shifts/[id]/candidates`). La
lógica es la misma: el orden de los postulantes, quién se destaca, las dos
pestañas, asignar y sus avisos.

- **Arriba, el cielo** con «Volver al panel», el título en brocha y la bajada.
- **El turno es una comanda** montada sobre el borde del cielo: el puesto en
  brocha, cuándo (con la duración) y el pago. Antes era una tarjeta con el
  ícono del rubro.
- **Postulantes:** el mejor valorado va en blanco con el borde y el relieve
  del filete, y «Mejor valorado» anotado a mano con una flechita (antes, la
  tarjeta en celeste lleno y el rótulo en mayúsculas). Los demás, planos con
  un filete.
- **Recomendados:** el primero dice «el que te recomendamos», a mano y con
  la flechita, con el mismo relieve (antes, celeste lleno con «Recomendado
  por Oído» y un rayo en ámbar). Los demás, planos.

Técnico: `app/shifts/[id]/candidates/page.tsx`; `components/CandidateCard.tsx`
suma el prop `relieve` (la landing vieja de `/historia` sigue con la de
siempre); `components/ui/Comanda.tsx` suma `Flechita`; en `globals.css`,
`.flechita` y `.tarjeta-relieve`. El test que buscaba el destacado por su
celeste (`postulantes-desasignados.spec.ts`) lo busca por `data-destacado`.
Spec nuevo: `candidatos-relieve.spec.ts`.

**Por qué así:**

- **Un solo relieve por lista**, el del destacado, como en el Panel: en la
  prueba el recomendado era la única tarjeta con relieve y los demás iban en
  una lista con filete.
- **El ámbar del rayo se fue** del recomendado: con «Asignar» en ámbar y con
  relieve al lado, eran dos ámbar en la misma tarjeta.
- **Las tarjetas de los demás siguen siendo tarjetas**, no renglones: llevan
  sellos, chips de confianza y su botón, y en escritorio van en grilla.

**Queda abierto:** Mis turnos (ítem 0 de `STATUS.md`). Las pestañas
(`SegmentedControl`) y la Garantía Oído son de toda la app y siguen como
estaban.
