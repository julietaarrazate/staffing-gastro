# Propuesta: horarios del equipo del comercio (2026-11-22)

> Estado: **propuesta, no decidida**. Se valida con encargados de la beta en
> diciembre y, si da bien, lleva ADR antes de escribir código (enero).
> Maqueta navegable, privada: https://claude.ai/artifact/Y6zUc1LHNg7XxBG8jaDS2E
> (5 pantallas). Contexto de negocio: pestaña «Banco de ideas» y «Calendario»
> del documento de crecimiento (https://claude.ai/artifact/HPGMp7JFA9prJmBdEazLPP).

## El problema

Cubrir un turno es una necesidad de una o dos veces por mes: entre una y otra
el comercio se olvida de Oído. La grilla de horarios, en cambio, el encargado
la arma todas las semanas (hoy en una planilla de Google con una hoja por
sector: Cocina, Camareros, Barra, Encargados; personas por días; «F» = franco,
«ausente» = imprevisto; colores por turno mañana o tarde). **El faltazo nace en
la grilla**: si la grilla vive en Oído, Oído se entera primero y el hueco se
cubre desde ahí.

## Lo que se propone

| Pieza | Cómo |
|---|---|
| Dónde | **Sin botón nuevo en la barra.** El Panel del comercio (`/shifts`) suma dos vistas debajo del cielo: **Turnos \| Equipo**. Comparten la tira de la semana. En Turnos, un aviso «Viernes faltan 2 en cocina» lleva a Equipo |
| Horarios | Semana por **sector** (pestañas, «+ Sector»), personas × días, como la planilla. Turnos frecuentes a un toque (8–16, 13–21), turnos cortados, «Copiar semana anterior», «Mandar al equipo», registro de quién cambió qué |
| Estados de una celda | Horario · Franco · **Vacaciones** · **Falta justificada** · **Falta** (imprevisto). Sólo la falta abre «Cubrir»; vacaciones y justificada se cubren a mano con el «+» |
| Fila «Están» | Cuántos hay por día (3/4); con menos de lo planeado aparece «Cubrir viernes: faltan 2» (el único ámbar) |
| Cubrir | **Primero los Favoritos** del comercio; si nadie lo toma en 15 min, **toda la red** con la paga que elija. **El equipo fijo no recibe el aviso** (está de franco y descansa; decisión de Julieta) |
| Empleado | Cuenta de trabajador normal. Marca **entrada y salida** con el QR del local (ubicación sólo en ese momento, sin seguimiento ni biometría) y **avisa que falta desde la app** (no por WhatsApp): el encargado se entera al instante y arranca Cubrir |
| Resumen | Horas, extras, tardanzas, faltas, justificadas y vacaciones por persona, por semana, quincena o mes; Excel y mail al contador. **Oído junta las horas; el contador liquida** (no se calculan sueldos) |

## Reglas que la propuesta fija (a confirmar en el ADR)

- **Oído no le ofrece turnos al equipo de un comercio.** El empleado tiene una
  cuenta normal y puede buscar turnos si quiere, pero no recibe avisos de turnos
  en sus francos. Motivo: quien adopta la grilla es el dueño; si lo lee como
  «Oído me saca la gente», no invita a su equipo. Además, ofrecer turnos en el
  franco empuja contra el descanso. Se le promete al dueño por escrito.
- **Privacidad en las dos direcciones:** el comercio ve las marcas de su local
  y nada más (no ve qué hace la persona en otros locales); las marcas no se usan
  en el marketplace. Cambia quién ve qué: ADR nuevo y, probablemente, texto de
  `/privacidad` (sube `LEGAL_TERMS_VERSION`).
- **Descanso:** revisar con la asesoría el descanso entre jornadas y el franco
  semanal antes de cualquier aviso al trabajador.

## Lo que se descartó

- **Stock y mermas:** es otro producto (recetas, proveedores, inventario), lo
  cubren los sistemas de caja, pide carga diaria y no termina en un turno.
- **Liquidar sueldos:** responsabilidad legal del contador (convenio, cargas).
- **Vista de un día por vez como principal:** la planilla real muestra que por
  sector la semana entera entra en el celular (3 o 4 personas por hoja).
- **Avisar primero al equipo fijo** (primera versión de la maqueta): corregido
  por Julieta, ver arriba.

## Orden propuesto

1. Antes del 13/12: nada de esto; la beta prueba lo central.
2. Diciembre: entrevistas a 5 a 10 encargados con la maqueta. Preguntas: cómo
   arman hoy la grilla y cuánto tardan; qué le mandan al contador; si invitarían
   a su equipo a marcar en la app; si pagarían por esto dentro del plan. Seguir
   si 3 de cada 5 la quieren.
3. Enero: **calculadora de personal** primero (pública, sin registro: «cuántos
   mozos, bartenders y bacheros para 80 cubiertos o un evento de 150» y el
   resultado se publica como turnos; también sirve para SEO). **Favoritos más
   visibles** en el comercio (ya existen: módulo `favorite`).
4. Si las entrevistas validan: ADR (modelo de empleado del comercio, privacidad,
   marcas) y construcción por etapas: horarios → marcas → resumen.

Competencia (de memoria, sin precios ni verificación al 2026-11-22): 7shifts,
Homebase, Deputy, When I Work, Sling, Connecteam, Factorial. Ninguna cubre el
hueco con gente del rubro: esa es la diferencia.
