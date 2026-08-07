# Retención de datos de identidad — base legal (Ley 25.326)

> Parte de la **EPIC-001 · Trust & Identity Platform**. Fundamenta la política
> de retención del dominio **Identity** ([`ADR-0010`](../adr/ADR-0010-modelo-de-confianza-cuatro-dominios.md) §4,
> [`TRUST_SYSTEM.md`](../TRUST_SYSTEM.md) §3).
>
> ⚠️ **No es un dictamen legal.** Es investigación de orientación para diseñar
> el sistema con criterio normativo, no sólo de ingeniería. Antes de almacenar
> la primera imagen de un DNI real hay que **confirmar con asesoría legal** y
> revisar el **texto vigente** de la normativa y las guías de la **AAIP**
> (la ley 25.326 es de 2000 y hay procesos de modernización en curso; verificar
> actualizaciones). Conocimiento con fecha de corte — no asumir que esto está
> al día.

## 1. Marco aplicable

- **Constitución Nacional, art. 43** — acción de *habeas data*: toda persona
  puede acceder a los datos sobre sí misma y exigir su rectificación o
  supresión.
- **Ley 25.326 de Protección de los Datos Personales** (y su Decreto
  1558/2001). Autoridad de aplicación: **AAIP** (Agencia de Acceso a la
  Información Pública).
- **Resoluciones de la AAIP** relevantes para seguridad y datos biométricos
  (p. ej. medidas de seguridad recomendadas). Verificar las vigentes.
- Contexto: Argentina tiene **decisión de adecuación** de la UE; conviene
  diseñar alineado a principios tipo GDPR (minimización, limitación de
  finalidad y de plazo) porque es hacia donde va la modernización.

## 2. Categorías de dato que maneja Identity

| Dato | ¿Sensible / alto riesgo? | Comentario |
|---|---|---|
| **Nº de documento (DNI)** | Dato personal (identificador). No "sensible" en el sentido del art. 2, pero de alto impacto por fraude/suplantación. | Minimizar; sólo si hay finalidad concreta. |
| **Imagen del DNI (frente/dorso)** | Alto riesgo. Contiene identificadores + a veces datos que rozan lo sensible. | Candidato #1 a **eliminación tras la decisión**. |
| **Selfie / foto de rostro** | **Biométrico** → tratado como de alto riesgo/sensible por la AAIP. | Minimizar, cifrar o eliminar; consentimiento explícito. |
| **Prueba de vida (liveness)** | Biométrico. | Idealmente procesar y **no** retener el crudo; guardar sólo el resultado. |
| **Mayoría de edad** | Derivado. | Guardar el **hecho** (mayor de edad sí/no) o la fecha validada, no necesariamente la imagen. |

> **Datos sensibles (art. 2, Ley 25.326):** los que revelan origen racial/
> étnico, opiniones políticas, convicciones religiosas/filosóficas, afiliación
> sindical, salud o vida sexual. Los **biométricos** (rostro, liveness) son
> tratados por la AAIP con el estándar de alto riesgo. El diseño debe asumir
> el estándar **más protector**.

## 3. Principios que obligan (y cómo se traducen)

- **Calidad / minimización (art. 4):** los datos deben ser *ciertos, adecuados,
  pertinentes y no excesivos*. Se **destruyen** cuando dejaron de ser
  necesarios para la finalidad. → *No guardar la imagen del DNI "por las
  dudas".*
- **Limitación de finalidad (art. 4):** sólo para el fin informado (verificar
  identidad). No reutilizar la imagen para otra cosa.
- **Consentimiento informado (art. 5):** el usuario debe consentir el
  tratamiento de forma libre, expresa e informada — especialmente para
  biométricos. → *Checkbox/registro de consentimiento específico para
  verificación de identidad, separado del consentimiento general.*
- **Seguridad (art. 9):** medidas técnicas y organizativas. → *Cifrado,
  control de acceso, auditoría.*
- **Derechos del titular (arts. 14-16):** acceso, rectificación y **supresión**.
  → *Poder borrar evidencias a pedido y por vencimiento.*
- **Registro de bases (art. 21):** las bases de datos personales deben
  registrarse ante la AAIP. → *Tarea de la operadora; anotarlo.*

## 4. Requisitos de conservación

- **Plazo:** conservar **sólo mientras dure la finalidad**. Para verificación
  de identidad, la finalidad de la *imagen* se agota **cuando la revisión
  concluye** (aprobada o rechazada). El **hecho** verificado (el claim) y el
  rastro de auditoría pueden conservarse más tiempo con finalidad de
  constancia/antifraude.
- **No hay un plazo legal único**; se fija por finalidad + eventuales
  obligaciones (fiscales/laborales) que apliquen al negocio, no a la imagen del
  documento en sí.

## 5. Qué conviene almacenar / eliminar / cifrar

Aplicado al modelo **Claim/Evidence** ([TRUST_SYSTEM.md §3](../TRUST_SYSTEM.md)):

### Conservar (bajo riesgo, alta utilidad)
- **Claim**: tipo, estado (`verificada`/`rechazada`), nivel de confianza,
  fecha de decisión, expiración.
- **Auditoría de la Evidence**: método (`admin_manual`/…), **quién** verificó,
  cuándo, motivo de rechazo. *No* el archivo.
- El **hecho** de mayoría de edad (bool o fecha validada).

### Eliminar tras la decisión (alto riesgo, utilidad efímera)
- **Imagen del DNI** (frente/dorso).
- **Selfie** y **crudo de liveness**.
- Justificación técnica de por qué se puede eliminar: una vez que un humano (o,
  a futuro, un verificador automático) **decidió**, la afirmación queda
  registrada en el Claim + auditoría; la imagen ya cumplió su finalidad y
  **retenerla sólo agrega riesgo** (una base de imágenes de DNI es un objetivo
  de ataque y una responsabilidad bajo la Ley 25.326) sin beneficio
  proporcional. Esto es *storage limitation* + *data minimization* de manual.

### Cifrar (si por política antifraude hay que retener temporalmente)
- Si el negocio decide conservar la evidencia un tiempo acotado (p. ej. ventana
  antifraude), guardarla **cifrada en reposo**, con clave gestionada aparte,
  acceso auditado y **borrado automático** al vencer la ventana.
- Preferir **no retener** sobre retener-cifrado, salvo requisito concreto.

## 6. Cómo minimizar la exposición

- **Recolectar lo mínimo**: si alcanza con validar "mayor de edad", no guardar
  la fecha exacta ni la imagen — guardar el booleano.
- **Separar** almacenamiento de evidencias del resto de la app; acceso sólo
  para el rol admin-revisor, con auditoría de cada visualización.
- **No exponer** nunca las URLs de evidencia en respuestas públicas del perfil
  (sí, sólo, en la cola de revisión del admin).
- **URLs firmadas y de vida corta** mientras la evidencia exista; nunca links
  públicos permanentes.
- **Borrado real** del asset (no sólo olvidar la URL): requiere API firmada del
  storage (p. ej. Cloudinary `api_secret`) — **tarea de la operadora**, hoy
  pendiente (ver `CLAUDE.md`, "Pendiente de la operadora").
- **Consentimiento y transparencia**: informar qué se pide, para qué, cuánto se
  guarda y cómo se borra; registrar el consentimiento.

## 7. Riesgos legales del enfoque actual / ingenuo

| Riesgo | Descripción |
|---|---|
| **Retener imagen de DNI indefinidamente** | Viola minimización (art. 4); crea una base sensible registrable (art. 21) y un blanco de ataque. |
| **Biométricos sin consentimiento específico** | La selfie/liveness necesita consentimiento informado propio (art. 5). |
| **"Olvidar la URL" ≠ borrar** | Si el archivo sigue en el storage, el dato **no** fue suprimido a efectos legales. |
| **No poder ejercer supresión** | El titular puede exigir borrado (arts. 14-16); el diseño debe permitirlo. |
| **Base no registrada ante la AAIP** | Obligación formal si se tratan datos personales a escala. |

## 8. Recomendación para el diseño

1. **Default = no retener** la imagen del DNI ni la selfie: se eliminan al
   decidir; persisten Claim + auditoría. (Esto es lo que ya intuía la v1;
   acá queda **fundamentado en normativa**, no en preferencia.)
2. **Consentimiento específico** para verificación de identidad y biométricos.
3. **Cifrado en reposo + borrado automático** sólo si una política antifraude
   concreta obliga a una retención temporal acotada.
4. **Borrado real del asset** vía API firmada del storage (operadora).
5. **Confirmar con abogado/AAIP** el texto vigente, el registro de la base y
   los plazos antes de procesar DNIs reales.
