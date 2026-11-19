# Identidad por pantalla en la dirección suave: prueba en un lienzo (#696)

**Pedido:** Julieta (2026-11-19) volvió a mandar las cuatro referencias del
cielo y pidió retomar la identidad de cada pantalla: verlas, que no parezcan
hechas con IA ni genéricas, y que tampoco queden pesadas ni cargadas.

**Qué cambió:** nada en el código. Hay una prueba con diez pantallas a
390 × 844, en claro y en noche (cada una tiene el interruptor «noche») y
enlazadas entre sí: https://claude.ai/artifact/WJn8NkYTpvSsa81RpoR2Jg
(privado). Usa los valores de `frontend/app/globals.css` («La dirección
suave») y las fotos de `frontend/public/landing/`.

**Por qué así:** con «el cielo arriba y la hoja encima» en todas, las pantallas
vuelven a parecerse entre sí. La propuesta es que **el cielo cambie según lo
que la pantalla responde** y la hoja quede para actuar. El detalle, pantalla
por pantalla, está en
[`design-system/direccion-relieve.md`](../design-system/direccion-relieve.md),
«Identidad por pantalla».

**Queda abierto:** que Julieta la mire y decida. La prueba propone cambiar
tres cosas que ya estaban decididas para la dirección «con relieve» (la barra
de abajo, las pestañas y el «+» de publicar en la barra del comercio) y
muestra datos que hay que confirmar contra el producto antes de escribir
código. Las dos listas están en el mismo doc.
