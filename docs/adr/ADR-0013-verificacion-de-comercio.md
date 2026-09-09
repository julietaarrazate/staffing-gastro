# ADR-0013 — Verificación del comercio: qué prueba se pide, y qué NO se promete

**Estado:** aceptado · **Fecha:** 2026-09-09

## Contexto

`ShiftCard` renderiza un sello **"Comercio verificado"** desde el ADR-0011. El
campo `company_verified` viaja en la API, el feed lo lee del claim de negocio
con una consulta batcheada, y hay un test que lo cubre. Todo el camino de
lectura está construido.

Lo que no existe es el principio: **nada crea nunca un claim
`negocio_verificado`**. No hay endpoint por donde un comercio mande evidencia.
El resultado es que `company_verified` da `false` para todos los comercios,
siempre, sin excepción posible — el sello es hoy un elemento de UI que no puede
encenderse. El test que lo cubre inserta el claim a mano con el repositorio,
justamente porque no hay flujo real que ejercitar.

**La asimetría que esto deja abierta, que es el verdadero motivo de este ADR.**
Hoy el trabajador entrega DNI y selfie para probar quién es (ADR-0010, F1), y
el comercio no entrega nada. Pero el que viaja a la dirección de un
desconocido, trabaja un turno y después tiene que cobrar es el trabajador — es
la parte con más para perder y la que menos información tiene. `TRUST_SYSTEM.md`
§11.2 lo dice sin vueltas: *"si no, el trabajador decide a ciegas sobre quién le
va a pagar — el lado más caro de equivocarse"*. El modelo Claim/Evidence ya se
diseñó bidireccional (§11.3) precisamente para esto; sólo faltaba usarlo.

## Decisión

### 1. La prueba es la **constancia de inscripción de AFIP**

El comercio sube su constancia de inscripción (la que cualquiera baja gratis
del sitio de AFIP con su CUIT) y un admin la revisa a mano.

**Por qué no la habilitación municipal**, que probaría más: dejaría afuera a
buena parte del mercado real. Muchos locales chicos la tienen vencida, en
trámite, o a nombre del dueño anterior — situaciones normales en gastronomía
que no dicen nada sobre si el comercio es real y va a pagar. Un requisito que
la mayoría no puede cumplir hace que nadie se verifique, y entonces el sello
sigue sin aparecer nunca: exactamente el problema que este ADR viene a
resolver, con un paso extra de trabajo y la misma pantalla vacía.

La constancia, en cambio, la tiene cualquiera que esté inscripto, se baja en
dos minutos y es gratis. Prueba lo que el sello promete —que hay un negocio
registrado atrás, con nombre y domicilio fiscal— y nada más.

### 2. El claim es `negocio_verificado`, **no** `cuit_verificado`

`TRUST_SYSTEM.md` §11.3 nombra los dos, y no son sinónimos: `cuit_verificado`
está reservado para la verificación **automática contra AFIP** (la contraparte
de Renaper para personas). Lo que se construye acá es una persona mirando un
PDF, con `VerificationMethod.ADMIN_MANUAL`.

Usar el nombre `cuit_verificado` para esto sería cómodo y falso: dejaría el
sistema afirmando que el CUIT se validó contra la fuente cuando lo único que
pasó es que alguien miró un papel. Cuando exista la integración con AFIP entra
como un claim y un método más — que es exactamente para lo que el modelo se
diseñó extensible (ADR-0010 §3).

Mismo criterio, ya aplicado, en el mail de verificación de identidad del
trabajador: dice *"nuestro equipo revisa tu documento"*, nunca "verificación
instantánea".

### 3. **No se guarda el número de CUIT**

La constancia se sube como `Evidence`, se revisa, y su `data_url` **se purga al
decidir** — igual que el DNI del trabajador (ADR-0010 §4). No se agrega un
campo `cuit` a `CompanyProfile`.

El motivo no es pereza: no hay ni una sola funcionalidad que necesite el número.
Guardarlo sería acumular un identificador fiscal —que en un monotributista está
atado a su DNI, o sea que es dato personal— sin ningún uso, sólo porque pasó por
delante. El día que exista la verificación automática contra AFIP se decidirá
ahí qué se persiste y por qué.

Lo que queda es la constancia de la decisión: quién revisó, cuándo, con qué
método. Auditable sin conservar el dato sensible.

### 4. El sujeto del claim es `CompanyProfile.user_id`

Ya decidido en el ADR-0011 y respetado por `verified_business_user_ids`. Se
repite acá porque es la parte que más fácil se hace mal: el claim cuelga del
**usuario dueño** del comercio, no del `CompanyProfile`. El dominio Identity
modela sujetos, y el sujeto es siempre un `User` — por eso el mismo agregado
sirve para persona y para negocio sin redominar.

### 5. La subida va **firmada**, y con menos formatos que el CV

La constancia de AFIP es un PDF, y Cloudinary bloquea por default la entrega de
PDF subido con preset unsigned (ver `core/cloudinary.py` y el caso ya vivido con
el CV del trabajador). Se reusa la misma máquina de firma.

Los formatos permitidos son **más angostos** que los del CV
(`pdf,jpg,jpeg,png`, sin `doc`/`docx`): una constancia de AFIP nunca es un
documento de Word, y en una subida que respalda una decisión de confianza el
default correcto es aceptar lo mínimo que sirve.

## Consecuencias

- El sello "Comercio verificado" pasa a poder encenderse. Deja de ser
  decorativo.
- El trabajador gana, antes de aceptar un turno, la única señal de identidad
  que hoy no tenía sobre la otra parte.
- El comercio que se verifica gana que le acepten más turnos — es la
  contrapartida que hace que valga la pena el minuto de trabajo.
- **La revisión es manual y no escala sola.** Con volumen real esto necesita
  o la integración con AFIP (`cuit_verificado`) o más gente revisando. Se
  acepta a conciencia para la beta: es el mismo trato que la verificación del
  trabajador, que ya funciona así.
- **No hay expiración.** Una constancia aprobada queda aprobada. El campo
  `expires_at` del claim existe y queda sin usar, igual que en el claim de
  documento. Si más adelante se decide que una verificación de negocio caduca,
  el modelo ya lo soporta sin cambios.
- **El sello dice "es un negocio registrado", no "paga bien".** Son preguntas
  distintas y el producto ya las trata por separado: la reputación del comercio
  (puntualidad de pago, turnos publicados) es otra dimensión, con su propio
  tratamiento visual. Mezclarlas sería colapsar dimensiones independientes en
  un badge — lo que `TRUST_SYSTEM.md` §12 evita a propósito.
