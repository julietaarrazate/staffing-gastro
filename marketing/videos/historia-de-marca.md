# Video "historia de marca" (9:16, 48 s)

`oido-historia.mp4`. Es la adaptación a Oído de un prompt de "historia de marca
en 5 actos" que circula para videos de motion graphics. Se hizo sin
herramientas pagas: animación en HTML/CSS, música y efectos sintetizados con
código, y una voz TTS libre que corre local como **voz guía**. La versión para
publicar lleva voz humana (ver "Grabar la voz", abajo).

## Por qué el prompt original no se usa tal cual

El prompt está pensado para una marca que ya tiene historia: *"Nos conociste
en [hito]"*, apariciones en medios, el próximo evento, un mapa con los lugares
donde ya se vende. Oído está en beta cerrada en Palermo: no tiene un hito
conocido ni apariciones en medios, y está en un solo lugar. El prompt dice
**"no inventes datos"**, así que cada acto se reemplazó por su equivalente
verdadero:

| Acto del prompt | Acá | Por qué |
|---|---|---|
| 1 · Gancho: "Nos conociste en…" | El mensaje que todo gastronómico conoce: *"Perdón, hoy no llego"*, un viernes a la noche | Oído todavía no tiene un hito que citar. Lo que sí tiene el que mira es ese problema. |
| 2 · Lo que viene | "Somos Oído. Y este año nos vas a ver en Palermo." | Es la beta real (`docs/planning/LAUNCH_PLAN.md`). |
| 3 · Giro | "Pero antes, te queremos contar por qué existimos." | Igual que el original. Es la pausa más larga del video, y a propósito. |
| 4 · Origen: mapa + cómo se hace | Zoom de Argentina a Buenos Aires + el propósito de la marca + la app en uso | El propósito sale textual de `docs/design/ART_DIRECTION.md` §1.4. En Oído, lo que "se hace" es un turno cubierto, y eso es lo que se muestra: el pedido en una frase y el aviso a quien está cerca. |
| 5 · Viaje y presente | La ruta del trabajador al local (es "Va en camino"), la misión y **un solo** lugar marcado: Palermo | La misión es la de ART_DIRECTION, presentada como misión y no como algo ya logrado. Se marca un solo lugar porque es el único donde está Oído. |
| Cierre | Logo + "Personal gastronómico, ya." + `oido.com.ar` | El tagline vigente. |

La **transición firma**, que el prompt pide inspirada en un elemento de la
marca, son **las ondas del oído**: anillos que se abren desde donde va a
aparecer el isotipo, como sonido que llega a la oreja. Abre la marca (acto 2)
y cierra el video.

El remate del acto 4 usa el nombre: *"Y alguien contesta: ¡oído!"* Es lo que
se canta en una cocina cuando alguien confirma un pedido, y ahí la marca se
explica sola, sin decir "nuestro nombre significa…".

**Nada de competencia, ninguna cifra**: no se muestra un tiempo de cobertura
medido ni una cantidad de usuarios, porque todavía no hay datos reales que
los respalden. Las iniciales de los pines (LM, DR…) y "Martín · mozo" son
ilustrativos, como en los otros videos.

### Para confirmar antes de publicar

1. **"Este año nos vas a ver en Palermo."** Sale del plan de beta. Si la
   apertura no va a ser pública este año, cambiar la línea `v06`.
2. **"Oído nace en Buenos Aires."** Se asumió por la beta y el producto. Si
   la historia real es otra (otra ciudad, o el origen personal de la idea),
   conviene contarla: una historia propia engancha más que cualquier
   animación.
3. **"¡Oído!" como respuesta de cocina.** Si el nombre tiene otra historia,
   se ajustan las líneas `v12` y `v13`.

## Ritmo: por qué no se siente "hecho por IA"

Lo que delata a un video generado es que nunca respira: todo entra a la
misma velocidad y el texto se va antes de que termines de leerlo. Acá el
ritmo está escrito en el guion (`animacion/historia.guion.json`) y no depende
de quién lee:

- **Hay voz durante unos 32 de los 48 s.** El resto son pausas elegidas:
  después del mensaje del mozo (1,8 s sin voz, para leerlo y sentirlo),
  antes y después del giro, y antes del "¡Oído!", donde también se corta la
  batería.
- **El texto entra palabra por palabra al ritmo de la voz** (una palabra
  aparece apenas antes de oírse, así se lee a la par) y queda en pantalla
  después de que termina la frase: se va recién cuando empieza la siguiente
  idea.
- **Los cortes grandes caen sobre la grilla de la música** (80 BPM, un
  golpe cada 0,75 s), que es lenta a propósito: marca el paso sin apurar.
- **La música baja sola cuando alguien habla** (unos 10 dB, en 120 ms) y
  vuelve a subir en los silencios. Por eso las pausas no se sienten como
  huecos.
- **Mismo tratamiento de color en todo**: viñeta cálida y grano de película
  que cambia 12 veces por segundo. Dos tipografías de texto (Fraunces e
  Inter) más DM Mono para los rótulos, que ya es la regla de la marca.

## Guion

| id | seg | dur | Texto | En pantalla |
|---|---|---|---|---|
| v01 | 0,9 | 1,4 | Viernes a la noche. | igual, grande |
| v02 | 2,5 | 1,0 | Salón lleno. | igual, en ámbar |
| v03 | 4,0 | 1,5 | Y te escribe el mozo. | chico; a los 5,65 s llega "Perdón, hoy no llego." |
| — | 5,5–7,3 | | *(silencio: se lee el mensaje)* | |
| v04 | 7,3 | 3,2 | Si trabajás en gastronomía, conocés ese mensaje. | igual |
| — | 10,7 | | *(ondas del oído → ámbar)* | |
| v05 | 12,0 | 1,0 | Somos Oído. | isotipo + "oído" |
| v06 | 13,5 | 2,3 | Y este año, nos vas a ver en Palermo. | "Este año / nos vas a ver en Palermo." |
| v07 | 17,3 | 2,9 | Pero antes, te queremos contar por qué existimos. | igual, sobre crema, solo |
| v08 | 21,5 | 2,8 | Oído nace en Buenos Aires, con una idea simple: | mapa: Argentina → zoom a Buenos Aires |
| v09 | 24,8 | 3,5 | que ningún turno se caiga por no encontrar a quién llamar. | tarjeta blanca sobre el mapa |
| v10 | 29,2 | 2,2 | El comercio lo pide en una frase. | teléfono: se tipea el pedido y se publica |
| v11 | 32,4 | 2,0 | Le avisamos a quien está cerca. | mapa del barrio, ondas, aparecen trabajadores |
| v12 | 34,9 | 1,4 | Y alguien contesta: | *(se corta la batería)* |
| v13 | 36,9 | 0,7 | ¡Oído! *(otra voz: la del trabajador)* | globo "¡Oído!" y la ruta al local |
| v14 | 38,2 | 3,4 | Nuestra misión: cubrir un turno en menos de diez minutos. | tarjeta verde; a los 41,7 s, "Palermo · empezamos acá" |
| v15 | 43,4 | 0,7 | Oído. | ondas → logo |
| v16 | 44,4 | 1,9 | Personal gastronómico, ya. | tagline, y a los 46,3 s `oido.com.ar` |

## Grabar la voz

La voz guía (Kokoro, voz "Dora") sirve para ver el ritmo, pero suena
neutra y no rioplatense. **La versión que se publica tiene que llevar una voz
de verdad**, y conviene que sea la tuya: nada suena menos a IA que la persona
que hizo el producto contando por qué existe.

1. Con el grabador del celular, en un lugar chico con ropa o cortinas (un
   placard es ideal: casi no hay eco), a un palmo del teléfono.
2. **Una toma por línea**, cada una en su archivo: `v01.wav`, `v02.wav`… hasta
   `v16.wav`. `v13` ("¡Oído!") queda mejor con otra persona: es el
   trabajador que contesta.
3. No hace falta cortar el silencio de antes y después: `mezcla.py` lo
   recorta solo. Tampoco hace falta dejar pausas entre frases: las pone el
   guion.
4. Si el celular graba en `.m4a`, se pasa a `.wav` con
   `ffmpeg -i v01.m4a v01.wav` (el `ffmpeg` que trae `imageio-ffmpeg` sirve).
5. Van en `animacion/voz-grabada/`. `mezcla.py` usa esas tomas antes que la
   voz guía, y avisa si alguna dura bastante más que su `dur` en el guion. En
   ese caso se ajusta `dur`, y el `at` de las líneas siguientes, en
   `historia.guion.json`, y se vuelve a renderizar: el texto en pantalla
   sigue al guion.

Leé más lento de lo que te parece natural. En video, lo que al grabarlo se
siente lento suena tranquilo, y lo que se siente normal suena apurado.

### Si no se graba: una voz sintética argentina

Hay una sola voz libre con acento argentino: **Piper `es_AR-daniela-high`**
(femenina). Es gratis y corre local, pero su modelo sólo se publica en
HuggingFace, y la sesión cloud de Claude no llega ahí. Se baja en una
computadora común desde `huggingface.co/rhasspy/piper-voices`, carpeta
`es/es_AR/daniela/high`. Son dos archivos: `es_AR-daniela-high.onnx` y
`es_AR-daniela-high.onnx.json`. Van en `animacion/piper/`. Si están ahí,
`voz.py` usa esa voz sola para todas las líneas femeninas. Antes de publicar
hay que revisar la licencia en su ficha (`MODEL_CARD`).

Las voces "Elena" y "Tomás" de Microsoft (`es-AR`, vía `edge-tts`) suenan
mejor y también son gratis, pero no tienen licencia clara para uso comercial,
y la sesión cloud tampoco llega a ese servicio. No se usan acá.

## Cómo se regenera

Mismo circuito que las otras animaciones (ver `README.md`), con dos pasos más
para la voz y la mezcla:

```sh
pip install piper-tts kokoro-onnx soundfile numpy imageio-ffmpeg
# voz argentina (opcional, ver arriba): los dos archivos de Piper en animacion/piper/
# modelo de la voz guía (Apache 2.0), ~350 MB, a animacion/kokoro/:
#   github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
#   → kokoro-v1.0.onnx y voices-v1.0.bin
cd marketing/videos/animacion
python3 voz.py historia       # → voz/v01.wav … (sólo si no hay voz grabada)
python3 mezcla.py historia    # → historia.wav (música + efectos + voz)
node render.mjs historia      # → frames/historia/ (48 s, la duración sale del guion)
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
$FF -framerate 30 -i frames/historia/%04d.jpg -i historia.wav -c:v libx264 -pix_fmt yuv420p \
  -crf 18 -preset slow -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k -shortest \
  -movflags +faststart ../oido-historia.mp4
```

`loudnorm` deja el volumen en −14 LUFS, que es el nivel al que Instagram y
TikTok normalizan: más fuerte no suena más fuerte, sólo peor.

Para cambiar un tiempo: el `at` de la línea en el guion, y los
`animation-delay` de `historia.html` y los `put(…, segundo, …)` de
`mezcla.py` que caen alrededor. Están ordenados por escena y comentados.

## Corte de 15 s para anuncios

`oido-anuncio-15s.mp4`, para comercios. Son cinco compases de 3 s:

1. El mensaje "Perdón, hoy no llego" está en pantalla desde el primer cuadro,
   que es el que se ve como miniatura, y enseguida la pregunta
   *"¿Y ahora a quién llamás?"*.
2. Las ondas del oído llevan a la marca: "oído · Personal gastronómico, ya."
3. "Pedilo en una frase": el pedido se tipea y se publica.
4. "Le avisamos a quien está cerca", el "¡Oído!" y la ruta al local.
5. "Empezá gratis", `oido.com.ar` y "Beta en Palermo".

Sale **sin voz**, con música y efectos: los anuncios se miran casi siempre
sin sonido, y todo lo que dice la voz ya está escrito en pantalla. El guion
(`animacion/anuncio.guion.json`, líneas `a01`–`a07`) marca igual el ritmo de
los textos, así que la voz se agrega después sin tocar la animación: tomas
grabadas en `voz-grabada/a01.wav`…, o `python3 voz.py anuncio`, y después
`python3 mezcla.py anuncio` y el mismo `ffmpeg` con `anuncio`.

"Empezá gratis" se apoya en el plan gratis de ADR-0005. Si el plan cambia,
esa línea cambia con él.

## Bienvenida por rol (30 s cada una)

`oido-bienvenida-comercio.mp4` y `oido-bienvenida-trabajador.mp4`, para
mandar después del alta o tener en la página de ayuda. Tienen la misma forma:
la marca y el rol, **5 pasos de 4,5 s** con una barra de progreso arriba, y
un cierre con el primer paso a dar ("Publicá tu primer turno" o "Elegí tu
zona y empezá") y `oido.com.ar`.

| Paso | Comercio | Trabajador |
|---|---|---|
| 1 | Publicar el turno en una frase ("Describí el turno") | Zona y oficios, igual que en `/bienvenida` |
| 2 | "Le avisamos a quien está cerca", con los postulantes | Un turno cerca, con el pago a la vista → "Postularme" |
| 3 | Candidatos con su reputación → "Asignar" | "Te asignó el turno" → "Confirmar" |
| 4 | "Va en camino" en el mapa → "Llegó al local" | "Llegué" y "Me fui" (asistencia en 2 pasos, ADR-0008) |
| 5 | "Cerrar turno" → "Marcar como pagado" → calificar | Pagado, calificación y puntualidad |

Cada pantalla es la de la app en su versión mínima, con **los textos reales
de los botones**. Si la app cambia un texto, se cambia en `bienvenida.py` y
se regeneran los dos HTML. El paso 5 dice que el pago se arregla fuera de la
app **durante la beta**: cuando haya cobro real (TECH_DEBT P4), esa línea se
va.

Salen sin voz, igual que el anuncio. Las líneas `c01`–`c07` y `t01`–`t07`
de los guiones ya marcan el ritmo de los textos.

## Instalar Oído y activar los avisos (30 s cada uno)

`oido-instalar-android.mp4` y `oido-instalar-iphone.mp4`: uno por sistema,
así nadie tiene que elegir a mitad del video. En los dos hay 4 pasos para
instalar y 2 para los avisos, con un celular en pantalla donde se ve cada
toque:

| | Android | iPhone |
|---|---|---|
| 1 | Abrí oido.com.ar en Chrome | Abrí oido.com.ar en Safari |
| 2 | Tocá los tres puntitos, arriba a la derecha | Tocá el botón de compartir, abajo |
| 3 | Tocá «Instalar app» → «Instalar» | «Agregar a pantalla de inicio» → «Agregar» |
| 4 | Listo: el ícono en la pantalla | igual |
| Avisos | Abrila desde el ícono → «Activar» → «Permitir» | igual, y aclara que en iPhone sólo funciona desde el ícono |
| Si dijiste «Ahora no» | Perfil → «Notificaciones push» | igual |

**Sin tecnicismos a propósito**: nada de "PWA", "navegador" ni "permisos".
La hoja «Activá las notificaciones», con «Ahora no» y «Activar», y la fila
«Notificaciones push» del perfil son las de la app. Esa hoja aparece después
de publicar el primer turno o de la primera postulación, no al entrar. Los
menús de Chrome y Safari están simplificados, con los nombres de sus
opciones en español. Si el sistema los cambia, se corrigen en `instalar.py`.

**Lo de iPhone es una restricción real, no un detalle del video.** En Safari
común la app ni ofrece los avisos: `isPushSupported()` da falso y la fila
del perfil no aparece. Sólo funcionan con Oído instalado y abierto desde el
ícono. Hoy la app no le explica esto en ningún lado a quien entra desde un
iPhone.
