# Títulos en Schibsted Grotesk en vez de Bricolage (#PR)

**Pedido:** Julieta, 2026-10-18: "la fuente que usamos de referencia de
Pasito… la veo muy infantil para Oído". Era Bricolage Grotesque, la de los
títulos desde el 2026-10-12, que Pasito también usa en los suyos.

**Qué ve el usuario:** los títulos de la landing ("Encontrá tu mozo",
"Pedilo como lo dirías"…) y los de pantalla de la app ("¿Qué necesitás?",
"Ingresar", "Crear cuenta", el puesto de un turno) pasan a Schibsted
Grotesk. El texto sigue en Inter, los datos en DM Mono y el logo "oído" en
Fraunces.

**Qué cambió (técnico):** `app/layout.tsx` carga `Schibsted_Grotesk` como
`--font-schibsted`; `--font-display` apunta ahí (`app/globals.css`), y las
dos reglas `.landing-*` que nombraban `--font-bricolage` pasan a
`--font-display`. El titular del inicio (`HeroRueda.tsx`) y `.landing-h2`
aflojan el espaciado de `-0.045em` a `-0.035em`. `typography.md`
actualizado.

**Por qué así:** se compararon cinco gratuitas (Inter Tight, Schibsted
Grotesk, Instrument Sans, Hanken Grotesk y Geist) contra Bricolage; Schibsted
es firme y tiene algo de cartel, sin el tono lúdico, y no compite con el
filete porteño de la landing.
