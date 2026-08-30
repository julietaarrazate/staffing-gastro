# Rediseño visual de Oído — mockups

Exploración de identidad de marca e interfaz para Oído (staffing gastronómico).
Trabajo **visual / de diseño**, sin implementar todavía: son maquetas HTML
autocontenidas (abrilas en el navegador) que sirven de referencia para, cuando
esté aprobado, bajarlo a los tokens reales (`app/globals.css`) y aplicarlo por PR,
pantalla por pantalla.

## Dirección aprobada

- **Estilo:** "Contraste" — tarjetas oscuras (`#191410`) sobre crema, el naranja
  como único acento de acción, con modo claro (tarjetas blancas) equivalente.
- **Tipografía:** display `Bricolage Grotesque` (reemplaza a Fraunces), cuerpo
  `Hanken Grotesk`, datos/etiquetas en `Space Mono`.
- **Acentos de identidad:** naranja (acción), **manteca** (datos), **celeste**
  (confianza/verificación).
- **Logo real** (la mano al oído), wordmark `oído` en minúscula. Sin el "damero".

## Archivos

| Archivo | Qué es |
|---------|--------|
| `01-identidad.html` | Tablero de identidad: paleta, tipografía, elementos. |
| `02-tres-direcciones.html` | Las 3 direcciones comparadas (Contraste / Aire / Cálido). Se eligió **Contraste**. |
| `03-app-claro-oscuro.html` | La app con modo claro/oscuro conmutable: inicio, buscar por categoría, detalle, perfil, panel del comercio, **ranking de perfiles con puntaje**, mapa. |
| `04-landing.html` | Landing **original** (centrada, serif) recoloreada con los acentos nuevos. |
| `05-onboarding-ubicacion.html` | Onboarding de comercio y trabajador + pantalla de geolocalización (claro por defecto). |
| `06-mails.html` | Los 4 mails transaccionales recoloreados (identidad pasa de petróleo a azul celeste). |

## Pendiente / en discusión

- Métricas del ranking (Puntualidad / Trabajo / Presentación): confirmar el set.
- Modo por defecto (claro u oscuro) al abrir la app.
- Bajar la paleta y tipografías a `globals.css` una vez cerrado el diseño.
