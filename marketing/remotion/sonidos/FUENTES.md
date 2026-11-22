# Sonidos de los videos de Oído

Todos de [Freesound](https://freesound.org), con licencia **Creative Commons 0** (dominio
público: uso comercial sin atribución obligatoria). No hay voces, ni locución ni nada generado
con IA: efectos grabados, un murmullo de salón y una guitarra tocada por una persona.

Lo que está acá son **recortes** (cada uno de menos de 1 MB). Los originales no se suben:
`bash sonidos/bajar-sonidos.sh` los baja a `sonidos/originales/` y `bash sonidos/recortar.sh`
vuelve a armar los recortes desde ahí.

| Archivo | Qué es | Original | Autor | Licencia |
|---|---|---|---|---|
| `murmullo.mp3` | Murmullo de salón de fondo, 36 s | [«ambience - restaurant.WAV»](https://freesound.org/people/soundtracvkradio/sounds/394678/) | soundtracvkradio | CC0 |
| `toque.mp3` | Toque de pantalla | [«PhoneTaps.wav»](https://freesound.org/people/djf54/sounds/469297/) | djf54 | CC0 |
| `campanita.mp3` | Campanita del pase («¡Oído!») | [«Service Bell Ding»](https://freesound.org/people/Qvantor/sounds/879808/) | Qvantor | CC0 |
| `vibracion.mp3` | Celular que vibra | [«Mobile_Phone_iphone_Vibrate_Metal_Tin.wav»](https://freesound.org/people/tompallant/sounds/260955/) | tompallant | CC0 |
| `tipeo.mp3` | Tipeo en el celular | [«Smartphone Touchscreen Tapping, Texting or Messaging, Gaming»](https://freesound.org/people/ahriik/sounds/631822/) | ahriik | CC0 |
| `impresora-corta.mp3` | Tic-tic corto de impresora de comandas | [«epson receipt printer7»](https://freesound.org/people/azumarill/sounds/345057/) | azumarill | CC0 |
| `bossa.mp3` | Música de fondo: guitarra de nylon, acordes de bossa | [«Rozenbaum Chords Bossa.wav»](https://freesound.org/people/FullMetalJedi/sounds/400698/) | FullMetalJedi | CC0 |

## Cómo se prepararon (`recortar.sh`)

- **Efectos**: el tramo que se usa, con el pico a -3 dBFS y fundidos de 5 y 60 ms.
- **Impresora**: antes sonaba fuerte y con chirrido. Ahora es medio segundo (un tic-tic), con
  pasa bajos en 4,2 kHz y pasa altos en 180 Hz, y en la mezcla va unos 8–10 dB más bajo que antes.
- **Murmullo**: el tramo de 22 a 58 s de la toma (el que menos se habla), filtrado como si viniera
  del salón de al lado (pasa bajos en 1,1 kHz y un eco corto), a -23 LUFS. Ese filtro saca la
  habla inteligible: se verificó con faster-whisper (modelo small, local), que no encuentra ningún
  segmento de voz ni en detección automática ni forzado a castellano. Sin el filtro, la toma tiene
  frases en inglés que se entienden.
- **Bossa**: la toma de 22 s encadenada consigo misma con un fundido de 2 s (cubre hasta 42 s), a
  -23 LUFS. La descripción del autor: «Piece of music on jazz chords»; guitarra de nylon tocada
  por una persona (no generada).

## La mezcla

En `src/kit/sonido.tsx` (`GANANCIA`) y en los datos de cada pieza (`sonido.cues`: efecto, cuadro,
dB). Balance medido con `bash scripts/niveles.sh como-funciona-comercios`: efectos ≈ -20 LUFS,
murmullo ≈ -30, música ≈ -37 (unos 16–17 dB debajo de los efectos), con fundido de entrada y de
salida. El total se lleva a -14 LUFS en `scripts/normalizar.sh`.
