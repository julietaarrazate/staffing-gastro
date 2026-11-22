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
| `hielo.mp3` | Hielo que cae en vasos | [«ice cubes falling and moving in glasses (A)»](https://freesound.org/people/krakenkraft/sounds/784030/) | krakenkraft | CC0 |
| `coctelera.mp3` | Coctelera batiendo | [«Cocktail Shaker.wav»](https://freesound.org/people/KenRT/sounds/319995/) | KenRT | CC0 |
| `tabla.mp3` | Cuchillo sobre la tabla (tres cortes) | [«Chopping Board»](https://freesound.org/people/Ultra-Edward/sounds/795433/) | Ultra-Edward | CC0 |
| `copa.mp3` | Copa que se apoya en la mesa | [«glass of wine down on counter or table.flac»](https://freesound.org/people/kyles/sounds/637584/) | kyles | CC0 |
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

## De Mixkit (música y efectos de la versión con tomas reales)

[Mixkit](https://mixkit.co): «Stock Music Free License» y «Sound Effects Free License», uso comercial
en redes sin atribución (no cubren TV, radio ni juegos). No van a git: `bash sonidos/bajar-mixkit.sh`
los baja a `public/sonidos/mixkit/`. Se usan por nombre en `sonido.musica`, `sonido.ambiente` y
`sonido.cues` (ver `src/kit/sonido.tsx`).

| Archivo | Descarga | Qué es |
|---|---|---|
| `mixkit/upbeat-jazz.mp3` | [Upbeat Jazz, Francisco Alvear](https://assets.mixkit.co/music/644/644.mp3) | Música: jazz alegre, 99 bpm |
| `mixkit/bar-lleno.mp3` | [Very crowded pub or party loop (360)](https://assets.mixkit.co/active_storage/sfx/360/360-preview.mp3) | Bar repleto, para el arranque |
| `mixkit/restaurante.mp3` | [Restaurant crowd talking ambience (444)](https://assets.mixkit.co/active_storage/sfx/444/444-preview.mp3) | Ambiente de restaurante |
| `mixkit/whoosh.mp3` | [Fast whoosh transition (1490)](https://assets.mixkit.co/active_storage/sfx/1490/1490-preview.mp3) | Paso entre tomas |
| `mixkit/pop.mp3` | [Dry pop up notification alert (2356)](https://assets.mixkit.co/active_storage/sfx/2356/2356-preview.mp3) | Aparece la hoja del texto |
| `mixkit/cubiertos.mp3` | [Taking cutlery from a plate (133)](https://assets.mixkit.co/active_storage/sfx/133/133-preview.mp3) | Cubiertos |
| `mixkit/puerta-campanita.mp3` | [Cartoon door melodic bell (110)](https://assets.mixkit.co/active_storage/sfx/110/110-preview.mp3) | Campanita de la puerta |
| `mixkit/risas.mp3` | [Small man crowd laughing (423)](https://assets.mixkit.co/active_storage/sfx/423/423-preview.mp3) | Grupo que se ríe |
| `mixkit/campana-pase.mp3` | [Service bell (931)](https://assets.mixkit.co/active_storage/sfx/931/931-preview.mp3) | Campana del pase |
| `mixkit/plato.mp3` | [Plate over a plate (2935)](https://assets.mixkit.co/active_storage/sfx/2935/2935-preview.mp3) | Plato sobre plato |
| `mixkit/platos-cocina.mp3` | [Kitchen plates rattle (1848)](https://assets.mixkit.co/active_storage/sfx/1848/1848-preview.mp3) | Platos en la cocina |
| `mixkit/copas.mp3` | [A couple of glasses clink (154)](https://assets.mixkit.co/active_storage/sfx/154/154-preview.mp3) | Copas que chocan |
| `mixkit/copa-clink.mp3` | [Wine glass clink (2936)](https://assets.mixkit.co/active_storage/sfx/2936/2936-preview.mp3) | Una copa |
| `mixkit/plato-suave.mp3` | [Gentle plate grab (1853)](https://assets.mixkit.co/active_storage/sfx/1853/1853-preview.mp3) | Plato que se levanta |
| `mixkit/campanitas.mp3` | [Happy bells notification (937)](https://assets.mixkit.co/active_storage/sfx/937/937-preview.mp3) | Cierre |
