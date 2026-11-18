# Fotos de la landing: qué va en cada lugar

> Lista para reemplazar las fotos de banco de `frontend/public/landing/` por
> fotos de locales porteños (STATUS, ítem 4). Escrita el 2026-11-17. Cuando
> Julieta pase las fotos, se exportan como dice abajo y se reemplazan los
> archivos **con el mismo nombre**: el código no cambia.

## Dónde aparecen hoy

| Lugar | Archivos | Cuántas | Cómo se ven |
|---|---|---|---|
| Rueda del inicio (`HeroRueda.tsx`) | `mozo1-3`, `bar1-3`, `barista1-2`, `cocina1-3`, `cocinera` | 12 | Fichas verticales que giran en círculo alrededor del título. Ancho en pantalla: 104 px (celular), 140 px (tablet), 170 px (escritorio); alto ×1,3. La parte de abajo se funde con el cielo (máscara del 62 % al 92 % del alto) |
| «Turnos cerca tuyo» (`ParaTrabajar.tsx`) | `mozo1` (la misma de la rueda) | 1 | Franja de arriba de una tarjeta: 360 × 128 px en celular, 360 × 160 px en escritorio. Arriba a la izquierda lleva el chip «A 300 m» |
| Mapa de «va en camino» (`MapaCamino.tsx`) | `mapa-palermo.webp` | — | No es foto: queda como está |

La miniatura para compartir (`assets/og/filete-oido.png`) no usa fotos.

## La rueda: 12 fotos verticales

**Formato.** Vertical 4:5. Original de al menos 960 × 1200 px; se exporta a
**480 × 600 px, WebP calidad 80** (cada una pesa entre 10 y 30 KB).

**Encuadre.**

- Plano medio: de la cintura o el pecho para arriba, con las manos en el
  trabajo (sirviendo, batiendo, emplatando, cobrando).
- La persona **centrada**: la ficha gira y se recorta parejo de los dos lados.
- Lo importante **en los dos tercios de arriba**: el tercio de abajo se funde
  con el cielo y casi no se ve.
- Luz cálida de salón o de barra, sin ventanas a contraluz. Nada de flash.
- Sin marcas ni logos legibles (botellas, delantales, carteles).
- Sin clientes reconocibles al fondo.

**Qué va en cada archivo** (para que la rueda tenga de todo y acompañe la
palabra que cambia: mozo, bartender, bachero, barista, cocinero, runner,
cajera, moza):

| Archivo | Qué mostrar |
|---|---|
| `mozo1.webp` | Moza o mozo en el salón con la bandeja, mirando a cámara o casi. **Es también la de «Turnos cerca tuyo»** (ver abajo): conviene que la cara quede en el centro |
| `mozo2.webp` | Mozo o moza llevando platos a una mesa |
| `mozo3.webp` | Mozo o moza tomando el pedido con la comanda en la mano |
| `bar1.webp` | Bartender sirviendo un trago, la botella en el aire |
| `bar2.webp` | Manos con la coctelera o el mezclador, de cerca |
| `bar3.webp` | La barra con una o dos personas trabajando, más abierta |
| `barista1.webp` | Barista texturizando la leche o sirviendo un café |
| `barista2.webp` | Barista en la máquina, de perfil |
| `cocinera.webp` | Cocinera o cocinero en la línea, con fuego o plancha |
| `cocina1.webp` | Cocina con dos o tres personas (ayudante incluido) |
| `cocina2.webp` | Bachero o bachera en la bacha, con vapor si hay |
| `cocina3.webp` | Manos emplatando, de cerca |

Que haya mujeres y varones, edades distintas, y que se note Buenos Aires
cuando se pueda (un bodegón, una barra de Palermo, una cafetería de barrio).

## «Turnos cerca tuyo»: la franja de la tarjeta

Usa `mozo1.webp` recortada al medio (`object-cover`): de una foto 4:5 queda
una franja de 9:4 a la altura del pecho y la cara. Por eso `mozo1` tiene que
tener la cara **en el centro vertical** de la foto, no arriba. Si la mejor
foto de mozo no cumple eso, se agrega un archivo aparte (`mozo-franja.webp`,
1200 × 540 px, 9:4) y se cambia una línea en `ParaTrabajar.tsx`.

El chip «A 300 m» tapa la esquina de arriba a la izquierda: que ahí no haya
nada importante.

## Permisos

Por cada foto: autorización por escrito de **cada persona que se reconoce**
(cesión de uso de imagen para la web y redes de Oído) y del **local** donde
se sacó. Guardar las autorizaciones fuera de este repo, que es público.
Los créditos de las fotos de banco quedan en
`docs/historial/2026-10-18-landing-cielo.md` como registro de lo que se usó
antes.

## Cuando lleguen

1. Exportar como dice arriba (mismo nombre de archivo).
2. Reemplazar en `frontend/public/landing/`.
3. Mirar la rueda en celular y escritorio, y la tarjeta de «Turnos cerca
   tuyo»: que ninguna cara quede cortada ni en la parte que se funde.
4. Sacar de `HeroRueda.tsx` el comentario de «fotos de prueba».
5. Cerrar el ítem 4 de `docs/STATUS.md` (o dejar sólo lo de la cita real).
