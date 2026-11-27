# Receta del teaser «El futuro de la gastronomía»

Los programas que rehacen la presentación 3D y sus videos a partir de dos
entradas privadas. Qué es todo esto, dónde están los videos y cómo retomarlo:
[`docs/reference/TEASER_FUTURO_GASTRONOMIA.md`](../../docs/reference/TEASER_FUTURO_GASTRONOMIA.md).

```bash
npm ci
./receta.sh            # lista los pasos
```

Las entradas (`guion.js` y `referencia.html`) no están en el repo: se bajan de
la página privada del archivo a `trabajo/entrada/`. Todo lo que se genera queda
en `trabajo/`, que git ignora.

| Archivo | Qué es |
|---|---|
| `receta.sh` | Los pasos, en orden |
| `adaptar.js`, `miniaturas.js`, `capturar.js` | De la referencia y el guion a la presentación en español |
| `preparar.js` | Le agrega a la presentación el reloj manual para grabarla |
| `linea.js`, `linea.json` | La línea de tiempo: en qué cuadro cambia cada escena |
| `sonido.js`, `recortar-sonido.js` | Graba la banda de sonido y la alinea con los cuadros |
| `cuadros.js`, `corte-h.json`, `corte-v.json` | Dibuja los tramos de cada corte |
| `armar.js` | Une cuadros, sonido y placa en los MP4 |
| `placa.js`, `placa-h.png`, `placa-v.png`, `fuentes/` | La placa final con la marca |
