# La app sin marrones: noche azul en oscuro y cielo en claro (#PR)

**Pedido:** Julieta, 2026-10-19, después de la landing "cielo": "adentro la
app tiene que mantener coherencia, siento que quedaron colores marrones que
ya no van, y también el modo oscuro un marrón y naranja que no tienen que
ver con lo actual".

**Qué ve el usuario:**

- **Modo oscuro:** el fondo, las tarjetas y los grises pasan de café cálido a
  una noche azul (lienzo `#0D131A`, tarjeta `#151D26`, recesado `#1C2631`,
  foco `#263240`); el resplandor de la esquina pasa de naranja a celeste y
  los links ("Estoy acá", "Ver todos", "¿Olvidaste tu contraseña?") y las
  insignias, de ámbar a celeste.
- **Modo claro:** arriba de cada pantalla, el resplandor ámbar y durazno (que
  dejaba un arranque color crema) pasa al cielo celeste de la landing.
- **Los dos:** la pestaña activa del menú de abajo pasa de un fondo ámbar
  suave a celeste. El ámbar queda para la acción principal de cada pantalla
  ("Publicar turno", "Ingresar"), como en la landing.

**Qué cambió (técnico):** tokens del bloque `:root[data-theme="dark"]` y
`--wash`/`--glow-image` del bloque celeste de `app/globals.css`; en oscuro
`--color-primary-text` y `--color-primary-tint` pasan a celeste.
`components/BottomNav.tsx` usa `bg-primary-tint` en vez de `bg-primary/12`.
`docs/design-system/color-system.md` actualizado con los contrastes nuevos
(todos AA o más: tinta 15,2, suave 8,2, apagada 5,5 y celeste 9,6 sobre la
tarjeta).

**Por qué así:** la escala café era la "noche cálida" de la paleta v5.0, de
antes del celeste; quedó así cuando la paleta cambió el 2026-10-09. La noche
azul es el cielo de la landing de noche y deja un solo acento ámbar por
pantalla.
