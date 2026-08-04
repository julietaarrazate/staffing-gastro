# Brief de identidad visual — Staffya

> Documento para entregarle a un diseñador de marca / ilustrador.
> Contiene el contexto del producto, los entregables, las especificaciones
> técnicas exactas que la app necesita y las restricciones que no se negocian.
>
> Preparado: 2026-07-28.

---

## 1. Qué es Staffya

Marketplace de **staffing gastronómico en tiempo real** para Argentina.
Conecta comercios (bares, restaurantes, eventos) con trabajadores eventuales
para cubrir turnos.

**La promesa, en una línea:** cubrir una posición eventual en **menos de 10
minutos**.

**Los dos usuarios:**

| | Comercio | Trabajador |
|---|---|---|
| Quién es | Dueño o encargado de un bar/restaurante | Mozo, bartender, cocinero, runner |
| Cuándo abre la app | Se le cayó alguien y el salón está lleno | Buscando turnos para esta semana |
| Estado emocional | **Apurado, con estrés real** | Buscando ingreso, comparando ofertas |
| Qué necesita ver | Que alguien va a llegar, ya | Cuánto paga y qué tan lejos queda |

**Esto importa para el tono:** no es una app de bienestar ni un juego. Es una
**herramienta de trabajo donde se gana plata**. Tiene que sentirse cálida y
cercana, pero **confiable antes que divertida**. Un dueño de restaurante a las
20:30 con el salón lleno no quiere emojis festivos en pantalla.

**Mercado:** Argentina (arranca en Palermo, CABA). Todo el producto está en
español rioplatense, con voseo ("publicá", "elegí", "postulate").

---

## 2. El problema a resolver

La app **funciona bien pero se ve genérica**. Podría ser cualquier producto:
fondo blanco, tarjetas, un acento naranja, tipografía de sistema. No hay nada
que la haga reconocible.

Le faltan los activos que hacen que una app se sienta *hecha por alguien*:

1. **Logotipo propio.** Hoy hay un ícono genérico (una campana de servicio
   dentro de un cuadrado redondeado) + la palabra "staffya" tipeada en la
   tipografía del sistema. No es un logotipo, es un ícono con texto al lado.
2. **Ilustración de marca.** No existe ninguna. Las pantallas vacías y de
   bienvenida no tienen nada propio.
3. **Tipografía con carácter.** Hoy usa Geist (tipografía de sistema, correcta
   pero neutra).

---

## 3. Entregables

### 3.1 Logotipo (prioridad 1)

- **Logotipo completo**: la palabra "staffya" **dibujada**, no tipeada. Se
  admite —y se prefiere— que sea una fundición existente bien elegida y luego
  ajustada a mano, más que un lettering desde cero.
- **Isotipo / marca corta**: la versión que entra en un cuadrado (ícono de app,
  favicon, avatar). Tiene que funcionar a **16 px** sin volverse ilegible.
- **Versiones obligatorias**:
  - Sobre fondo claro (blanco / `#F8F9FA`)
  - Sobre fondo oscuro (`#111111`)
  - Monocromo de un solo color (para el badge de notificaciones, donde el
    sistema operativo **descarta el color y usa sólo la silueta**)

> **Nota conceptual:** hoy la marca corta es "la cloche" (campana de servicio).
> No es obligatorio conservarla — está sobre la mesa reemplazarla. Lo que sí
> tiene que sobrevivir es el énfasis en el **"ya"** del nombre: es la promesa
> del producto y hoy se marca poniendo esas dos letras en naranja.

### 3.2 Ilustración (prioridad 2)

Un set chico y coherente, **3 a 5 piezas**, con un mismo estilo reconocible.
Dónde se van a usar:

| Pieza | Dónde aparece |
|---|---|
| Bienvenida | Primera pantalla del onboarding |
| "Todavía no hay turnos" | Feed vacío del trabajador |
| "Publicá tu primer turno" | Panel vacío del comercio |
| Éxito / turno cubierto | Confirmación tras asignar |

**Referencia de registro:** la app **Pasito** (`pasito.app`) — su personaje en
trazo continuo, de un solo color sobre fondo pleno. Nos interesa **el criterio,
no la forma**: un dibujo con gesto y personalidad, no un ícono. No copiar el
personaje ni el estilo puntual: Staffya necesita el suyo, y el mundo es
gastronómico (salón, barra, bandeja, cocina).

**Tono a evitar:** infantil, caricaturesco, "corporativo con gente sonriendo en
un escritorio", stock.

### 3.3 Tipografía (prioridad 3)

- Una **display** con carácter para títulos y el logotipo.
- La de texto puede seguir siendo Geist (funciona bien y ya está integrada).
- Debe tener licencia web y soportar **castellano completo**: tildes, `ñ`, `¿`,
  `¡`. Esto se verifica antes de aprobar.

---

## 4. Especificaciones técnicas (obligatorias)

La app es una **PWA** (se instala en el celular), así que los tamaños de ícono
no son negociables — los define el sistema operativo.

### Formatos fuente

- **SVG** para logotipo e isotipo (vectorial, editable, con las curvas
  convertidas a trazado).
- **SVG** también para las ilustraciones. Si el estilo exige raster, entonces
  **PNG a 3x** con fondo transparente.
- Archivo editable original (`.ai`, `.fig` o `.svg` con capas).

### Íconos de app — tamaños exactos

| Archivo | Tamaño | Uso | Requisito especial |
|---|---|---|---|
| `icon-192.png` | 192×192 | Ícono PWA | — |
| `icon-512.png` | 512×512 | Ícono PWA grande | — |
| `icon-maskable-512.png` | 512×512 | Ícono **maskable** de Android | El motivo debe entrar en el **80% central**: Android lo recorta en círculo, gota o cuadrado según el fabricante |
| `apple-icon.png` | 180×180 | iOS | iOS le agrega esquinas redondeadas solo; entregar **cuadrado, sin redondear** |
| `favicon.ico` | 16, 32, 256 | Pestaña del navegador | Tiene que leerse a 16 px |
| `badge-96.png` | 96×96 | Badge de notificación Android | **Fondo transparente y silueta opaca.** Android usa **sólo el canal alfa** y lo pinta blanco: si el fondo es opaco, sale un cuadrado blanco sólido |
| `og-image.png` | 1200×630 | Vista previa al compartir link | Legible como miniatura en WhatsApp |

> El `badge-96.png` es el que más se malinterpreta. Ya nos pasó: usábamos el
> ícono naranja completo y en Android aparecía un cuadrado blanco.

---

## 5. Restricciones de marca (no se negocian)

Estas reglas ya están implementadas en el producto y el diseño tiene que
respetarlas:

1. **Un solo acento naranja por pantalla.** El naranja marca *la acción
   principal*. Si hay dos naranjas compitiendo, ninguno significa nada.
2. **Cero gradientes decorativos multicolor.** Se permite el par de marca
   (`#FF6B00` → `#E85F00`) en superficies chicas.
3. **Paleta actual** (respetarla o proponer un cambio fundamentado):
   - Naranja: `#FF6B00` · Naranja fuerte: `#E85F00`
   - Ink (negro de marca): `#111111`
   - Superficie: `#F1F3F5` · Línea: `#ECECEE` · Fondo: `#F8F9FA`
   - Verde éxito: `#22C55E` · Rojo error: `#EF4444`
4. **Todo el texto en español rioplatense**, con voseo.
5. **Accesibilidad**: contraste mínimo **AA (4.5:1)** para texto sobre su
   fondo. Ojo con blanco sobre naranja puro — hoy no pasa, y por eso el trazo
   sobre naranja usa un blanco cálido (`#FFF6EE`) en vez de blanco puro.

---

## 6. Cómo se evalúa el trabajo

Preguntas concretas para aprobar o rechazar cada pieza:

1. ¿El isotipo se lee a **16 px**?
2. ¿El badge monocromo se entiende **sin color**, sólo por su silueta?
3. ¿La ilustración funciona **sobre claro y sobre `#111111`**?
4. Puestas tres pantallas juntas, ¿se ve que son **de la misma app**?
5. ¿Sobrevive a una foto de celular mal iluminada en un salón?
6. ¿Un dueño de bar de 50 años lo percibe **confiable**, no infantil?

---

## 7. Contexto de presupuesto y tiempos

- Producto **prelanzamiento**: beta cerrada arrancando en Palermo, sin usuarios
  reales todavía. Presupuesto acotado.
- Prioridad si hay que recortar: **logotipo primero**, ilustración después,
  tipografía al final.
- Referencia de mercado (Argentina, 2026): paquete chico de identidad entre
  **300 y 800 USD**.

## 8. Qué entrega el lado técnico

Una vez recibidos los archivos, la implementación en la app corre por nuestra
cuenta: integración de la tipografía, exportación a los tamaños de arriba,
reemplazo del componente de logo (hoy es un SVG embebido en
`frontend/components/Logo.tsx`) y verificación de contraste. El diseñador no
necesita tocar código.

---

## Referencias que le gustan a la operadora

- **Pasito** (`pasito.app`) — personaje ilustrado, dos colores, onboarding de
  una pregunta por pantalla. La referencia principal de *registro*.
- **Clickie** — app de oficios; interesa cómo transmite confianza al mostrar
  profesionales (reseñas, motivos de recomendación).
