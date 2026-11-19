# ADR-0027 — El relieve del filete como profundidad de la interfaz

**Estado:** aceptado para la landing; en la app entra pantalla por pantalla ·
**Fecha:** 2026-11-18 · **Decisión de Julieta:** 2026-11-17 (seguir la
dirección «con relieve») y 2026-11-18 (el híbrido de la landing, la letra
mixta, los planes como carta)

## Contexto

Desde el pivot al lienzo blanco (2026-09-20) la elevación la daban una
hairline y dos sombras difusas (`--shadow-soft`, `--shadow-float`), más los
glows de color de los botones. Julieta marcó dos veces el resultado: «todo se
ve plano, todo parece un formulario del mismo tono» y «da a hecho con IA». La
marca ya tenía una profundidad propia que la interfaz no usaba: la sombra
dura azul hondo del «oído» fileteado, corrida abajo a la derecha.

## Decisión

1. **Esa sombra dura pasa a ser un nivel de elevación del sistema**, con sus
   tokens en `frontend/app/globals.css`: `--relieve` (azul hondo `#1c5478`;
   `#2e6e99` sobre la noche azul), `--shadow-relieve` (3 px, botón),
   `--shadow-relieve-md` (5 px, tarjeta), `--shadow-relieve-lg` (8 px, objeto
   grande) y `--radius-relieve` (10 px, botón recto).
2. **Un objeto con relieve por pantalla**, no una sombra más para todo: el
   botón principal y la tarjeta que importa. Lo demás sigue plano, con
   hairline. Las sombras difusas y los glows no se borran: siguen rigiendo
   donde no llegó el relieve.
3. **El botón con relieve se aprieta**: al tocarlo se corre lo que mide la
   sombra (`--relieve-btn`) y la sombra queda en cero. No se levanta al pasar
   el mouse.
4. **Lo que tiene relieve no flota.** Una sombra dura dice «apoyado»; las
   animaciones de flotar se sacan de esos objetos.
5. **Rige primero en la landing** (este PR). En la app entra un PR por
   pantalla, sin tocar la lógica, en el orden de
   [`direccion-relieve.md`](../design-system/direccion-relieve.md).

## Consecuencias

- Los tokens de color y sombra se declaran junto a la paleta, no en el primer
  `:root`: un subárbol forzado a claro (la landing) recalcula sus sombras con
  su azul. Si se suma una sombra de relieve, va en ese mismo bloque.
- Sobre fondos oscuros fijos (el panel «Para trabajar» de la landing, la
  pizarra) el relieve se declara a mano con el celeste o el azul que
  contraste; el token es para superficies del tema.
- Mientras dure la migración conviven dos lenguajes de elevación en la app.
  Es deliberado: cambiar todo junto obligaría a tocar todas las pantallas en
  un PR imposible de revisar.

## Descartado

- **Reemplazar las sombras difusas en todo el sistema de una vez:** mismo
  motivo, y además no todo objeto merece relieve.
- **Relieve ámbar:** el ámbar es la acción (un solo acento por pantalla); el
  relieve es la marca, y la marca es azul hondo.
