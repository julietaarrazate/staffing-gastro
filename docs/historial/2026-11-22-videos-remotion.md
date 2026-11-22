# Videos para redes en Remotion, guardados en el repo (marketing/remotion/)

**Pedido:** Julieta quería videos verticales para Instagram, TikTok y Facebook que lleven a instalar
la app, registrarse y publicar el primer turno, con el nivel de una app grande. Después pidió
guardar en el repo el código que los genera, con los sonidos y sus fuentes, y corregir el audio:
nada de voces, la impresora más suave, música del rubro tocada por una persona, castellano
rioplatense, «paga desde $60.000» y las cuentas `@oidoapp` (marca) y `@turnosgastro` (turnos).

**Qué cambió:** se agregó `marketing/remotion/`, un proyecto de Remotion con 10 piezas y 5
historias en loop:

- tres portadas del HTML + GSAP anterior con el mismo guion: «Qué resuelve Oído», «Para comercios»
  y «Para quien trabaja» (`src/piezas/redes.tsx`);
- siete con pantallas reales de la app: cómo funciona para comercios, cómo funciona para quien
  trabaja, instalar en Android (Chrome), instalar en iPhone (Safari), match (reputación y
  distancia), va en camino (de noche) y el cierre para comercios.

Cada pieza es un componente y sus datos van en `src/piezas/<pieza>.datos.ts`: textos, duración,
cuenta, paga, escenas y sonido. Las pantallas se capturan de `frontend/` con la API simulada como
en `frontend/e2e/` (`capturar/`, no van a git). Los sonidos son recortes CC0 de Freesound de menos
de 1 MB, con su fuente en `sonidos/FUENTES.md`. La mezcla se hace dentro de Remotion
(`src/kit/sonido.tsx`) y `scripts/renderizar.sh` deja dos versiones por pieza, con y sin música,
a -14 LUFS.

**Por qué así:**

- **Pantallas reales y no maquetas**, para no mostrar funciones que no existen.
- **Verdad del producto en los guiones**:
  - el puesto «bachero» no existe en la app, así que va mozo;
  - quien trabaja se postula y confirma, no «toma» el turno;
  - «Va en camino» muestra la última posición y una línea recta, nunca el recorrido (ADR-0014);
  - la distancia sale de «Recomendados», porque la pestaña de postulantes no la muestra.
- **Murmullo**: el de la toma original tenía frases en inglés que se entendían. Se filtró como si
  viniera del salón de al lado, y faster-whisper ya no encuentra voz.
- **Impresora**: se acortó a medio segundo, con filtro, y en la mezcla va 8–10 dB más baja.
- **Música**: guitarra de nylon con acordes de bossa, de FullMetalJedi (CC0, tocada por una
  persona). Se descartaron las candidatas marcadas como generadas con IA. Va unos 16–17 dB debajo
  de los efectos.
- **Sin WhatsApp propio**: la app no tiene un número de WhatsApp público, así que el cierre para
  comercios dice «link en la bio».

**Queda abierto:**

- Poner el número de WhatsApp en la bio de `@oidoapp`.
- El texto del paso de iPhone es el de la app («Agregar a inicio»); según la versión de iOS, el
  menú puede decir «Agregar a pantalla de inicio».
- Los MP4 no van al repo: se renderizan con `npm run render`.
