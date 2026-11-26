# Propuesta del ícono: el pinche real (sin decidir)

Pedido de Julieta (2026-11-24): un ícono menos plano que la comanda sola, más realista. En un pinche
de cocina cada comanda se clava como viene: quedan giradas para los dos lados y se forman puntas.
**No es la marca vigente** (la vigente: [`../../marca/`](../../marca/), ver
[`../../marca-hoy.md`](../../marca-hoy.md), punto 4).

| Archivo | Qué es |
|---|---|
| `C-real-3.svg`, `C-real-7.svg`, `C-real-11.svg` | **C · pinche real**, tres variantes (cambia el azar de los giros). La recomendada es la **3** (`C-real-3.svg`): las puntas más marcadas hacia los dos lados |
| `A-pila.svg` | A · pila de comandas más ordenada (primera prueba) |
| `B-volumen.svg` | B · la comanda actual con volumen: troquel, esquina doblada, sombra, pinche de metal |
| `vista-c-real.jpg` | Las tres variantes de C en grande |
| `vista-tamanos.jpg` | El ícono actual contra las variantes de C de 256 a 32 px, sobre claro y oscuro |
| `gen.py` | Arma los SVG (`python3 gen.py`): las letras de «oído» salen del ícono vigente, los colores son los de la marca |

**Recomendación:** C (variante 3) para el ícono grande (la app en el celular, 192 y 512 px). A 48 px
y menos la pila se empasta: para la pestaña y el favicon queda el ícono chico y plano de hoy.

**Para pasarla a la marca** (cuando Julieta elija): llevar el dibujo a
`frontend/scripts/build-isotipo-pinche.py` (que escribe todos los tamaños: grande, maskable para
Android con la zona segura, chico, silueta), regenerar `public/` y la miniatura, actualizar
`marca-hoy.md` y mirarlo en un celular real. Ojo: estos SVG usan degradés y filtros de sombra; para
la versión maskable y la silueta hay que simplificarlos.
