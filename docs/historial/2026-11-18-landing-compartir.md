# Landing: «Compartir» en el pie (beta, etapa 4)

**Pedido:** Julieta, 2026-11-18: «quiero tener un link directo para
compartir desde la landing, pero que no sea molesto de ver en la página».

**Qué cambió:** en el pie de la landing, al lado de «Términos y condiciones»
y «Privacidad», hay un «Compartir» del mismo tamaño y estilo. En el celular
abre el menú de compartir del teléfono, con un texto corto y el link a
`www.oido.com.ar`; donde no hay menú (una compu), abre WhatsApp con el mismo
texto y el link.

Técnico: `frontend/lib/landing-share.ts` (el texto y `shareLanding`, con el
mismo camino que compartir un turno en `lib/shift-share.ts`),
`components/landing/CompartirLanding.tsx` y una línea en `LandingFooter.tsx`.
Test en `e2e/landing.spec.ts` (con y sin menú de compartir).

**Por qué así:** va con lo legal porque ahí está a mano sin competir con los
dos botones de la página. El texto le habla a los dos lados, como la landing,
y no promete tiempos: «Te paso Oído: personal gastronómico en Buenos Aires.
Para locales que necesitan cubrir un turno y para quienes buscan turnos
cerca.» El link va aparte del texto: con los dos juntos WhatsApp lo repite.

**Queda abierto:** nada de esta pieza. Si hace falta saber cuánta gente
llega por links compartidos, se le puede sumar un `?ref=` como el de la
encuesta.
