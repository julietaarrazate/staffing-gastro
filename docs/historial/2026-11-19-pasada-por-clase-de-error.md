# La pasada por clase de error: qué se buscó, qué se encontró y dónde quedó cada arreglo

**Pedido:** Julieta, beta etapa 2 (2026-11-19, punto 1): un agente por clase
de error sobre turno, postulación, sesión, pagos y avisos; primero
concurrencia e idempotencia y privacidad entre roles, después estado viejo
con la pestaña abierta, sesión, escrituras que pisan otros datos y fechas y
zona horaria. Cada hallazgo verificado antes de entrar al tablero; arreglos
agrupados por causa, un PR por grupo, con revisión independiente y prueba
en la app. Y tests de contrato.

**Qué se hizo:** seis auditorías, cada una con su verificador (un agente
distinto que intentó refutar cada hallazgo, casi siempre con un test que
fallaba). Entraron 37 hallazgos confirmados (ESC-04 resultó ser el mismo
que CON-10) y se refutaron 3 (VIE-06, FEC-01, FEC-03). Ningún
bloqueante; graves: PRI-02 (pin desplazado), PRI-03 (CV público) y CON-02
(renovar la sesión cerraba la cuenta en todos lados). El detalle de cada
uno (escenario, archivo, test) no está en el repo, que es público.

| Grupo | PR |
|---|---|
| Datos de otra persona en la vista del trabajador (PRI-01, PRI-05) | #661 |
| Pin desplazado (PRI-02) | #665 |
| Tests de contrato | #666 |
| Pedidos repetidos (CON-01, CON-05, CON-12, CON-14) | #667 |
| Renovación de la sesión (CON-02, CON-03, SES-01; migración 0059) | #668 |
| CV y documentos de identidad (PRI-03; migración 0060) | #669 |
| Socket y avisos (PRI-04, VIE-04, CON-10) | #670 |
| Postulación con el estado viejo (VIE-01, CON-04, CON-11) | #671 |
| Borradores al cambiar de cuenta (SES-02, SES-03, SES-04) | #672 |
| Pantallas con reloj y relectura (VIE-02, VIE-03, VIE-05, FEC-02) | #673 |
| Escrituras enteras sin versión (ESC-01, CON-13, CON-08) | #674 |
| Formularios con la copia vieja (ESC-02, ESC-03) | #675 |

**Por qué así:** la línea de montaje auditor → verificador → arreglo →
revisión independiente → prueba en la app encontró algo en más de la mitad
de los arreglos *después* de que los tests del área estaban en verde: la
ventana de gracia de la sesión servía infinitas veces y después se
bloqueaba con `revoke_all`; `private` de Cloudinary deja públicas las
versiones transformadas (de ahí `authenticated`, también para los
documentos de identidad); el pin desplazado delataba su celda por los
decimales; una recarga silenciosa deshacía los descartes del feed. La
receta está en [`reference/SESION_CLOUD.md`](../reference/SESION_CLOUD.md) §8.

**Queda abierto:** el cobro con Mercado Pago (CON-06, CON-07, CON-09:
latente, antes de prender el cobro), tres decisiones de Julieta (PRI-06,
PRI-07, PRI-09, más el texto de `/privacidad` sobre el CV), lo que Julieta
corre después del deploy del #669 (`PENDIENTE_OPERATIVO`, 5c), y los
seguimientos de las revisiones, todo en
[`planning/BETA_TABLERO.md`](../planning/BETA_TABLERO.md) («Para la
próxima sesión»). Después, P1 a P5.
