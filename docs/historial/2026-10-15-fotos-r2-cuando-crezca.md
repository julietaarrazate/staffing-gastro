# Fotos: migrar de Cloudinary a R2 cuando se pase el plan gratis

**Pedido:** Julieta, 2026-10-15. Preguntó por qué las fotos están en
Cloudinary y no en Cloudflare R2, y pidió dejar documentada la migración para
cuando se pase el plan gratis, porque R2 sale mucho más barato con volumen.

**Qué cambió:** sólo documentación. Ítem nuevo **I6** en
[`../TECH_DEBT.md`](../TECH_DEBT.md) con:
- la comparación de precios;
- un ejemplo con números;
- el disparador: ~20 de los 25 créditos de Cloudinary;
- los pasos de la migración.

**Por qué así:** hoy Cloudinary es gratis y hace las transformaciones que el
sitio ya usa (formato y tamaño automáticos, recorte para compartir, descarga
del CV). Migrar ahora es trabajo y riesgo sin ahorro. Con volumen, R2 no
cobra la descarga y Cloudflare Images cobra poco por transformación, así que
conviene cambiar al acercarse al tope gratis.

**Queda abierto:** la migración misma (con ADR) cuando se cumpla el
disparador.
