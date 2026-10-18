# Miniatura al compartir: el "oído" fileteado sobre el cielo (#PR)

**Pedido:** Julieta, 2026-10-18, después de mergear la landing "cielo": "la
miniatura de Oído para compartir por WhatsApp, quizás con el fileteado
porteño".

**Qué cambió:** la imagen que sale al compartir un link de Oído (WhatsApp,
Facebook, iMessage, X). Antes: isotipo, "oído" en Fraunces y el tagline sobre
crema. Ahora: el isotipo, la palabra "oído" fileteada de la landing (letras
crema y doradas, relieve ámbar, volutas, hojas celestes y flores) y
"Personal gastronómico, ya." sobre el cielo celeste de la landing. Sigue
todo centrado, así que el recorte cuadrado de WhatsApp la conserva entera.

Técnico: `lib/og-brand.tsx` arma la imagen igual que antes (cuadrada para
`/og/oido.jpg`, apaisada para `twitter-image`). El filete va como PNG
(`assets/og/filete-oido.png`, 46 KB) porque satori no dibuja texto dentro de
un SVG; cómo rehacerlo está en `assets/og/README.md`. Sale
`Fraunces-SemiBold.ttf`, que ya no usa nadie. El JPEG se aplana sobre el
celeste (`LIENZO`) en vez del crema.

**Por qué así:** la miniatura es lo primero que ve alguien de Oído antes de
entrar; tiene que ser la misma marca que encuentra en la landing.

**Ojo:** WhatsApp guarda la vista previa de cada link por un tiempo. Un link
ya compartido puede seguir mostrando la vieja; uno nuevo (o con `?v=2`)
muestra la nueva.
