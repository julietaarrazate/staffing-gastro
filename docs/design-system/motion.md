# Movimiento — cuándo anima Oído y cuándo no

> Creado 2026-09-23 con el primer pase de animaciones pedido por Julieta.
> Los **valores** (duraciones, curva, escala de toque) siguen en
> `docs/design/DESIGN_TOKENS.md` §3.7 y `frontend/lib/motion.ts`. Esto
> documenta las **reglas** y las piezas reutilizables.

## La regla

**Una animación confirma una acción o muestra un cambio. Nunca decora.**
Oído es una herramienta de trabajo que se abre diez veces por turno: lo que
se mueve sin motivo, cansa a la tercera vez.

1. **Corta.** Menos de 300 ms para la interfaz. La excepción es la
   confirmación de una acción importante (el check que se dibuja, ~0,5 s),
   porque ahí el tiempo ES el mensaje.
2. **Sólo cuando pasa algo ahora.** Lo que ya estaba hecho al entrar a una
   pantalla aparece quieto (`initial={false}`, `DrawnCheck animate={false}`).
   Festejar algo viejo en cada visita es ruido.
3. **Nada en bucle, salvo una espera.** El único loop permitido es el de un
   loader, porque indica "estoy trabajando". Lo urgente del mapa late porque
   es una alerta, no un adorno.
4. **Sin rebote en la interfaz** (DESIGN_TOKENS §3.7). El mapa es la
   excepción deliberada: sus pines aparecen y se eligen con overshoot.
5. **"Reducir movimiento" siempre gana.** Framer Motion: `useReducedMotion()`
   y cambiar a sólo-opacidad o a nada. CSS: la regla global de `globals.css`
   ya deja cualquier `animation` en 0,01 ms. La información nunca depende de
   la animación: el texto dice lo mismo sin ella.
6. **Una confirmación no se tapa.** Lo que viene después (la invitación a
   notificaciones, una navegación) espera a que se vea el check.

## Piezas (en `frontend/components/ui/`)

| Pieza | Qué hace | Dónde se usa |
|---|---|---|
| `DrawnCheck` | Círculo + tilde que se dibujan. `animate` sólo si la acción acaba de pasar. | Detalle de turno ("Ya te postulaste"), `ConfirmOverlay` |
| `ConfirmOverlay` | Tapa una tarjeta con el check + una palabra (+ un detalle opcional) antes de que la pantalla siga. Padre `relative` con radio propio. | Mapa ("Te postulaste"), postulantes ("Asignado" + nombre) |
| `CountUp` | Número que cuenta de 0 al valor al entrar en pantalla, una vez. Si el valor cambia, sigue desde el anterior. | "Turnos activos" del comercio, "Ganado este mes", cifras de la landing |
| `OidoLoader` | La mano de Oído en su tile ámbar, con ondas y un ladeo de "escuchar". Para esperas **largas**; lo corto sigue con el spinner del botón. | Asistente de IA, "Describí el turno", carga del panel de admin |

## Los momentos (2026-09-23)

- **Postularse** (detalle de turno): el botón sale achicándose y entra el
  panel verde con el check dibujándose. La invitación a notificaciones sale
  1,2 s después.
- **Postularse desde el mapa**: la tarjeta se tapa con la confirmación 0,9 s
  y recién ahí sale de la lista (las demás se reacomodan con `layout`).
- **Asignar** (postulantes y recomendados): el elegido sube arriba con
  "Asignado" + su nombre, el resto se atenúa, y a los 1,1 s vuelve al panel.
- **Pin del mapa**: al elegirlo crece con rebote y sale una onda ámbar una
  sola vez (`markerHalo`, se monta con la selección).
- **Números**: cuentan al entrar ("Turnos activos", lo ganado en el mes).
- **Esperas de IA**: `OidoLoader` con "Oído está escuchando…" / "Leyendo tu
  pedido…".
