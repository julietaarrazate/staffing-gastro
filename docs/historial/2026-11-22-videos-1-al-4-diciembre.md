# Videos del 1 al 4 de diciembre, desde los guiones

**Pedido:** Julieta pidió las 11 piezas ya armadas (con música) y producir los 6 videos nuevos del
1 al 4/12 según la pestaña Guiones del documento de crecimiento, respetando la sección Tono.

**Qué cambió:** seis composiciones nuevas en `marketing/remotion/` (9:16, 25 a 30 s, sin voz):
`t6-05-sabado`, `que-es-oido-30s`, `t2-09-hielo`, `t3-05-cebolla`, `t1-04-orden-de-servicio` y
`c2-07-costo-encargado`. Textos, tiempos y sonido en `src/piezas/diciembre.datos.ts`; dibujos en
`src/piezas/diciembre.tsx`; kit de láminas (hoja blanca con dibujo SVG, sello «¡OÍDO!», cierre de
@turnosgastro) en `src/kit/lamina.tsx`. La mezcla (`src/kit/sonido.tsx`) suma `musicaDesde` y
`murmulloDb` para que la música arranque donde dice cada guion. Cuatro efectos nuevos de Freesound,
todos CC0 (hielo, coctelera, cuchillo, copa), anotados en `sonidos/FUENTES.md`.

**Por qué así:** el guion pide imágenes de cámara (salón, vasos, cebolla); en vez de video generado
(cuesta créditos, ADR-0030) van dibujos simples con la paleta de la marca, y las pantallas de la app
son capturas reales. Sin manos, así que no aplica la nota de los dedos doblados. Única corrección
de texto: «Mandáselo», con tilde.

**Fotos (pedido de Julieta, mismo día):** «el final quedaría mejor con una foto de comercio y de un
empleado», y foto donde el guion pide imagen real. Los bancos gratis no se pudieron usar desde la sesión
(Unsplash pide verificar navegador, Pexels y Openverse devuelven 403; Commons CC0 casi no tiene fotos útiles).
Julieta señaló las fotos de la landing: los seis cierres llevan un comercio y alguien trabajando, y cuatro
escenas pasan a foto (el pase con el sello «¡OÍDO!», el salón de «Qué es Oído», el hielo nuevo y el mozo con
los platos). Las escenas que explican (flechas, pasos de la cebolla, la fórmula) siguen dibujadas.

**Queda abierto:** Julieta decidió (24/11) mergearlos como base y guía, sin publicarlos tal cual. Antes del
merge, el cierre de «Orden de servicio» pasó de `cocina2` (cocina de una cadena con su logo a la vista) a
`cocina1`. Para publicar alguno, revisar: «Elegís y listo» contra la pantalla que dice «falta que confirme»,
el dibujo de la medialuna y la nitidez de las fotos de 480 × 600.
