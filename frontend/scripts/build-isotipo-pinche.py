#!/usr/bin/env python3
"""Genera los vectores del ícono «el pinche con oído» (2026-11-18).

    pip install fonttools brotli uharfbuzz
    python3 scripts/build-isotipo-pinche.py        # desde frontend/
    node scripts/build-icons.mjs                   # después, los PNG y el .ico

Escribe en `public/` (logo-mark, logo-mark-chico, logo-maskable, logo-figure)
y en `docs/design-system/marca/` (isotipo-pinche*.svg, mismos vectores para el
diseñador). La geometría es la del dibujo aprobado por Julieta (comanda
clavada en el pinche, lienzo de 512). La diferencia con el boceto es la letra:
en el boceto era `<text>` en Shrikhand y acá va **convertida a trazos**, así
que los SVG no dependen de ninguna fuente. Los trazos salen de
`app/fonts/shrikhand-oido.woff2` (el recorte trae «o», «í», «d»), con el
kerning que aplicaría el navegador (HarfBuzz).

Versiones:
- grande: relieve duro azul corrido abajo a la derecha + «oído» fileteado.
- maskable: la grande, achicada y centrada para entrar en la zona segura de
  Android (círculo central del 80 %), fondo a sangre.
- chica (48 px para abajo): plana, con la «o» sola, sin relieve.
- silueta: un solo color (blanco), con la «o» calada; sin fondo.
"""
import io
import math
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

RAIZ = Path(__file__).resolve().parent.parent  # frontend/
PUBLIC = RAIZ / "public"
MARCA = RAIZ.parent / "docs" / "design-system" / "marca"
FUENTE = RAIZ / "app" / "fonts" / "shrikhand-oido.woff2"

# Colores del tema claro del boceto (TEMA.claro).
FONDO, FIG, REL, SEC, DET = "#1C5478", "#FFFFFF", "#0F3A5B", "#9AC9E7", "#1C5478"
RADIO = 112  # esquinas del tile, como el resto de los íconos de la app

# Ajustes medidos sobre el render (ver la verificación del historial).
ESC_GRANDE, DESP_GRANDE = 0.94, -6  # igual que el boceto
ESC_CHICO = 1.1
ESC_MASKABLE = 0.80  # se recalcula con `medir`; ver MASKABLE abajo
SILUETA = (0.97, 3.6, 15.5)  # (escala, dx, dy): dibujo plano centrado, ~12 px de margen
MASKABLE = (0.872, -13.3, -8.5)  # (escala, dx, dy): círculo de 196 px de radio centrado

# --- la fuente --------------------------------------------------------------
_tt = TTFont(str(FUENTE))
_tt.flavor = None
_buf = io.BytesIO()
_tt.save(_buf)
_bytes = _buf.getvalue()
_tt = TTFont(io.BytesIO(_bytes))
_gs = _tt.getGlyphSet()
_upm = _tt["head"].unitsPerEm
_font = hb.Font(hb.Face(_bytes))


class _Pen(BasePen):
    """Pasa un contorno a `d` de SVG aplicando una transformación afín."""

    def __init__(self, gs, aff):
        super().__init__(gs)
        self.aff, self.d = aff, []

    def _p(self, pt):
        a, b, c, d, e, f = self.aff
        x, y = pt
        return f"{a * x + c * y + e:.2f} {b * x + d * y + f:.2f}"

    def _moveTo(self, pt):
        self.d.append("M" + self._p(pt))

    def _lineTo(self, pt):
        self.d.append("L" + self._p(pt))

    def _qCurveToOne(self, p1, p2):
        self.d.append("Q" + self._p(p1) + " " + self._p(p2))

    def _curveToOne(self, p1, p2, p3):
        self.d.append("C" + self._p(p1) + " " + self._p(p2) + " " + self._p(p3))

    def _closePath(self):
        self.d.append("Z")


def mul(m, n):
    """m ∘ n (se aplica n primero) para afines (a,b,c,d,e,f)."""
    a1, b1, c1, d1, e1, f1 = m
    a2, b2, c2, d2, e2, f2 = n
    return (a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1)


def trasl(x, y):
    return (1, 0, 0, 1, x, y)


def esc(s):
    return (s, 0, 0, s, 0, 0)


def rot(grados, cx, cy):
    r = math.radians(grados)
    c, s = math.cos(r), math.sin(r)
    return mul(trasl(cx, cy), mul((c, s, -s, c, 0, 0), trasl(-cx, -cy)))


def letras(texto, x, y, tam, espaciado, aff=(1, 0, 0, 1, 0, 0)):
    """Trazos de `texto` centrado en `x` sobre la línea de base `y` (como
    `text-anchor="middle"` con `letter-spacing`), tamaño `tam`. `aff` se aplica
    después, sobre las coordenadas del lienzo."""
    buf = hb.Buffer()
    buf.add_str(texto)
    buf.guess_segment_properties()
    hb.shape(_font, buf)
    k = tam / _upm
    ancho = sum(p.x_advance for p in buf.glyph_positions) * k + espaciado * len(texto)
    pen_x = x - ancho / 2
    d = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        nombre = _tt.getGlyphName(info.codepoint)
        m = mul(aff, (k, 0, 0, -k, pen_x + pos.x_offset * k, y - pos.y_offset * k))
        pen = _Pen(_gs, m)
        _gs[nombre].draw(pen)
        d.extend(pen.d)
        pen_x += pos.x_advance * k + espaciado
    return "".join(d)


# --- las formas (portadas de pincheMarca en el boceto) -----------------------
def forma(c, chico, e, letra_defs=None):
    """Una capa del dibujo. `c` = dict de colores, `e` = trazo del papel,
    `letra_defs` = (ids de las letras) o None si la capa no lleva letra."""
    g = 26 if chico else 16
    tr = f' stroke="{c["fig"]}" stroke-width="{e}" stroke-linejoin="round" stroke-linecap="round"' if e else ""
    papel = "M62 112H450V352L402 400H62Z" if chico else "M84 142H428V332L384 376H84Z"
    dobl = "M450 352L402 400V352Z" if chico else "M428 332L384 376V332Z"
    return (
        f'<ellipse cx="256" cy="436" rx="{124 if chico else 112}" ry="{34 if chico else 26}" fill="{c["fig"]}"/>'
        f'<path d="M256 330V432" stroke="{c["sec"]}" stroke-width="{g}" stroke-linecap="round" fill="none"/>'
        f'<g transform="rotate(-6 256 262)"><path d="{papel}" fill="{c["fig"]}"{tr}/>'
        f'<path d="{dobl}" fill="{c["sec"]}"/>{letra_defs or ""}</g>'
        f'<path d="M256 {26 if chico else 50}V{136 if chico else 168}" stroke="{c["sec"]}" stroke-width="{g}" stroke-linecap="round" fill="none"/>'
        + ("" if chico or e == 2 else f'<ellipse cx="256" cy="170" rx="17" ry="6" fill="{c["det"]}" opacity=".55"/>')
    )


def dibujo_grande():
    """(defs, cuerpo) de la versión grande, en coordenadas del lienzo de 512."""
    palabra = letras("oído", 258, 296, 122, 2)
    rel = {"fig": REL, "sec": REL, "det": REL}
    tema = {"fig": FIG, "sec": SEC, "det": DET}
    defs = (
        f'<path id="o-letras" d="{palabra}"/>'
        f'<g id="o-relieve">{forma(rel, False, 2)}</g>'
    )
    capas_rel = "".join(
        f'<use href="#o-relieve" transform="translate({k:g} {k:g})"/>'
        for k in [18 - 1.5 * i for i in range(12)]
    )
    sombra = "".join(
        f'<use href="#o-letras" transform="translate({k:g} {k:g})" fill="#14456A" stroke="#14456A" stroke-width="3"/>'
        for k in [9 - 1.5 * i for i in range(6)]
    )
    letra = (
        sombra
        + '<use href="#o-letras" transform="translate(2 2)" fill="#C98A1A"/>'
        + '<use href="#o-letras" fill="#FFF4CC" stroke="#14456A" stroke-width="5" paint-order="stroke"/>'
    )
    return defs, capas_rel + forma(tema, False, 0, letra)


def dibujo_chico():
    tema = {"fig": FIG, "sec": SEC, "det": DET}
    letra = f'<path d="{letras("o", 262, 366, 300, 0)}" fill="{REL}"/>'
    return "", forma(tema, True, 22, letra)


def envolver(titulo, defs, cuerpo, esc_, dx, dy=None, redondo=True):
    dy = dx if dy is None else dy
    fondo = f'<rect width="512" height="512" rx="{RADIO}" fill="{FONDO}"/>' if redondo else f'<rect width="512" height="512" fill="{FONDO}"/>'
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" '
        f'aria-label="Oído"><title>{titulo}</title>{fondo}'
        + (f"<defs>{defs}</defs>" if defs else "")
        + f'<g transform="translate({256 + dx:g} {256 + dy:g}) scale({esc_:g}) translate(-256 -256)">{cuerpo}</g></svg>\n'
    )


def silueta():
    esc_, dx, dy = SILUETA
    # Mismo dibujo plano de la versión chica, un solo color, con la «o» calada:
    # un clipPath de rectángulo + contornos de la «o» (evenodd) recorta todo.
    aff = mul(trasl(256 + dx, 256 + dy), mul(esc(ESC_CHICO * esc_), trasl(-256, -256)))
    aff = mul(aff, rot(-6, 256, 262))  # la «o» vive dentro del grupo rotado
    hueco = letras("o", 262, 366, 300, 0, aff)
    c = {"fig": FIG, "sec": FIG, "det": FIG}
    cuerpo = forma(c, True, 22).replace(
        f'<path d="M450 352L402 400V352Z" fill="{FIG}"/>', ""
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" '
        'aria-label="Oído"><title>Oído</title>'
        f'<defs><clipPath id="calado"><path clip-rule="evenodd" d="M0 0H512V512H0Z{hueco}"/></clipPath></defs>'
        f'<g clip-path="url(#calado)" fill="{FIG}"><g transform="translate({256 + dx:g} {256 + dy:g}) scale({ESC_CHICO * esc_:g}) translate(-256 -256)">{cuerpo}</g></g></svg>\n'
    )


def main():
    defs_g, cuerpo_g = dibujo_grande()
    defs_c, cuerpo_c = dibujo_chico()
    esc_m, dx_m, dy_m = MASKABLE
    salidas = {
        "mark": envolver("Oído", defs_g, cuerpo_g, ESC_GRANDE, DESP_GRANDE),
        "chico": envolver("Oído", defs_c, cuerpo_c, ESC_CHICO, 0),
        "maskable": envolver("Oído", defs_g, cuerpo_g, esc_m, dx_m, dy_m, redondo=False),
        "silueta": silueta(),
    }
    destinos = {
        "mark": ["logo-mark.svg", "isotipo-pinche.svg"],
        "chico": ["logo-mark-chico.svg", "isotipo-pinche-chico.svg"],
        "maskable": ["logo-maskable.svg", "isotipo-pinche-maskable.svg"],
        "silueta": ["logo-figure.svg", "isotipo-pinche-silueta.svg"],
    }
    for clave, nombres in destinos.items():
        for nombre in nombres:
            carpeta = PUBLIC if nombre.startswith("logo-") else MARCA
            (carpeta / nombre).write_text(salidas[clave], encoding="utf-8")
    print("vectores escritos:", ", ".join(n for ns in destinos.values() for n in ns))


if __name__ == "__main__":
    main()
