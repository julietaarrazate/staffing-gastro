// Chrome de Android y Safari de iPhone, dibujados fieles pero simplificados y
// sin logos de marca. Coordenadas CSS de la pantalla (390 × 844 debajo de la barra de estado).
import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { BAR, cap } from "./telefono";

const fuenteSistema = "Inter, system-ui, sans-serif";
const ent = (f: number, d: number, fps: number, cfg = {}) => spring({ frame: f - d, fps, config: { damping: 22, stiffness: 180, ...cfg } });

// Íconos de trazo (los mismos de frontend/components/landing/iconos.tsx y unos pocos del sistema).
export const Ico = {
  tresPuntos: (c = "#202124", s = 22) => <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.9" fill={c} /><circle cx="12" cy="12" r="1.9" fill={c} /><circle cx="12" cy="19" r="1.9" fill={c} /></svg>,
  compartir: (c = "#0A84FF", s = 24) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10H5V21H19V10H16" /><path d="M12 15V3M8 7L12 3L16 7" /></svg>,
  agregar: (c = "#111", s = 24) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3.5" /><path d="M12 8V16M8 12H16" /></svg>,
  instalar: (c = "#444", s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M12 7v7M9 11.5l3 3 3-3" /></svg>,
  casa: (c = "#444", s = 22) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinejoin="round"><path d="M4 11L12 4l8 7v9h-5v-6H9v6H4z" /></svg>,
  candado: (c = "#5f6368", s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2"><path d="M4 8h16M4 16h16" strokeLinecap="round" /><circle cx="9" cy="8" r="2.4" fill="#fff" /><circle cx="15" cy="16" r="2.4" fill="#fff" /></svg>,
  atras: (c = "#0A84FF", s = 24) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4l-8 8 8 8" /></svg>,
  adelante: (c = "#0A84FF", s = 24) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4l8 8-8 8" /></svg>,
  libro: (c = "#0A84FF", s = 24) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round"><path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z" /><path d="M12 6v14" /></svg>,
  pestanas: (c = "#0A84FF", s = 24) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8"><rect x="7" y="3" width="14" height="14" rx="3" /><path d="M17 21H6a3 3 0 0 1-3-3V7" /></svg>,
  recargar: (c = "#111", s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" /></svg>,
};

// ── Chrome (Android) ───────────────────────────────────────────────
export const ChromeBarra: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: BAR, width: 390, height: 56, background: "#fff", display: "flex", alignItems: "center", gap: 10, padding: "0 6px 0 14px", fontFamily: fuenteSistema, zIndex: 20, boxShadow: "0 1px 0 rgba(0,0,0,.06)" }}>
    {Ico.casa("#444", 22)}
    <div style={{ flex: 1, height: 40, borderRadius: 20, background: "#F1F3F4", display: "flex", alignItems: "center", gap: 8, padding: "0 14px", fontSize: 16, color: "#202124" }}>
      {Ico.candado()}<span>oido.com.ar</span>
    </div>
    <div style={{ width: 22, height: 22, border: "2px solid #444", borderRadius: 5, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: "#444" }}>1</div>
    <div style={{ width: 40, height: 40, display: "grid", placeItems: "center" }}>{Ico.tresPuntos("#444", 22)}</div>
  </div>
);

export const AndroidGestos: React.FC<{ oscuro?: boolean }> = ({ oscuro }) => (
  <div style={{ position: "absolute", left: 0, bottom: 0, width: 390, height: 24, background: oscuro ? "transparent" : "#fff", zIndex: 21 }}>
    <div style={{ position: "absolute", left: 145, top: 10, width: 100, height: 4, borderRadius: 2, background: oscuro ? "rgba(255,255,255,.8)" : "#444" }} />
  </div>
);

export const ChromeSitio: React.FC = () => (
  <>
    <Img src={staticFile(cap("l-landing-chrome").f)} style={{ position: "absolute", left: 0, top: BAR + 56, width: 390, height: (390 * cap("l-landing-chrome").h) / cap("l-landing-chrome").w }} />
    <ChromeBarra />
    <AndroidGestos />
  </>
);

const ITEMS_MENU = ["Nueva pestaña", "Nueva pestaña de incógnito", "Historial", "Borrar datos de navegación", "Descargas", "Favoritos", "Pestañas recientes", "Compartir…", "Buscar en la página", "Traducir…", "Instalar app", "Sitio de escritorio", "Configuración"];
export const MENU_Y_INSTALAR = BAR + 8 + 52 + 10 * 46 + 23; // centro de «Instalar app»

export const ChromeMenu: React.FC<{ desde: number; hasta: number; resalta?: number }> = ({ desde, hasta, resalta }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < desde || f > hasta + 6) return null;
  const s = ent(f, desde, fps);
  const o = interpolate(f, [hasta, hasta + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const r = resalta !== undefined && f >= resalta ? interpolate(f, [resalta, resalta + 8], [0, 1], { extrapolateRight: "clamp" }) : 0;
  return (
    <div style={{ position: "absolute", right: 6, top: BAR + 6, width: 262, borderRadius: 14, background: "#fff", zIndex: 30, fontFamily: fuenteSistema,
      boxShadow: "0 8px 30px rgba(0,0,0,.22), 0 2px 6px rgba(0,0,0,.12)", transformOrigin: "100% 0", transform: `scale(${0.6 + 0.4 * s})`, opacity: Math.min(1, s * 2) * o, overflow: "hidden" }}>
      <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "space-around", borderBottom: "1px solid #eee" }}>
        {["→", "☆", "↓", "ⓘ", "↻"].map((g, i) => <span key={i} style={{ fontSize: 20, color: "#444", width: 30, textAlign: "center" }}>{g}</span>)}
      </div>
      {ITEMS_MENU.map((t, i) => {
        const esIns = t === "Instalar app";
        return (
          <div key={t} style={{ height: 46, display: "flex", alignItems: "center", gap: 16, padding: "0 18px", fontSize: 16, color: "#202124",
            background: esIns ? `rgba(28,84,120,${0.12 * r})` : undefined, fontWeight: esIns && r > 0.5 ? 600 : 400 }}>
            <span style={{ width: 22, display: "grid", placeItems: "center", opacity: esIns ? 1 : 0.55 }}>{esIns ? Ico.instalar("#444") : <span style={{ width: 16, height: 16, border: "1.8px solid #666", borderRadius: 4, display: "block" }} />}</span>
            {t}
          </div>
        );
      })}
    </div>
  );
};

export const ChromeDialogo: React.FC<{ desde: number; hasta: number }> = ({ desde, hasta }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < desde || f > hasta + 6) return null;
  const s = ent(f, desde, fps);
  const o = interpolate(f, [hasta, hasta + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 31, opacity: o }}>
      <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${0.32 * s})` }} />
      <div style={{ position: "absolute", left: 28, right: 28, top: 330, borderRadius: 28, background: "#F7F9FC", padding: "26px 24px 18px", fontFamily: fuenteSistema,
        transform: `scale(${0.9 + 0.1 * s})`, opacity: s, boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
        <div style={{ fontSize: 24, fontWeight: 500, color: "#1f1f1f" }}>Instalar app</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 20 }}>
          <Img src={staticFile("marca/isotipo-pinche-maskable.svg")} style={{ width: 52, height: 52, borderRadius: 26 }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#1f1f1f" }}>Oído</div>
            <div style={{ fontSize: 15, color: "#5f6368" }}>oido.com.ar</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 26 }}>
          <div style={{ padding: "10px 18px", fontSize: 16, fontWeight: 600, color: "#0B57D0" }}>Cancelar</div>
          <div style={{ padding: "10px 22px", fontSize: 16, fontWeight: 600, color: "#fff", background: "#0B57D0", borderRadius: 20 }}>Instalar</div>
        </div>
      </div>
    </div>
  );
};
export const DIALOGO_INSTALAR = { x: 316, y: 330 - BAR + 26 + 30 + 20 + 52 + 26 + 20 }; // centro aprox. de «Instalar» (CSS de página)

// ── Pantallas de inicio (genéricas) ───────────────────────────────
const APPS = [
  { n: "Teléfono", c: "#4CAF7A", g: "☏" }, { n: "Mensajes", c: "#5C8DF6", g: "✉" }, { n: "Cámara", c: "#7C8794", g: "◉" }, { n: "Galería", c: "#E8A23B", g: "▦" },
  { n: "Reloj", c: "#3D4A5C", g: "◷" }, { n: "Calendario", c: "#E3655B", g: "▤" }, { n: "Notas", c: "#E9C341", g: "✎" }, { n: "Ajustes", c: "#8E99A6", g: "⚙" },
  { n: "Música", c: "#C7577E", g: "♪" }, { n: "Clima", c: "#5AA7E0", g: "☀" }, { n: "Mapas", c: "#5BB57E", g: "⌖" }, { n: "Calculadora", c: "#55606E", g: "±" },
];

export const Inicio: React.FC<{ ios?: boolean; aparece: number; toque?: number }> = ({ ios, aparece, toque }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - aparece, fps, config: { damping: 11, stiffness: 160 } });
  const pulso = toque !== undefined ? interpolate(f, [toque - 1, toque + 3, toque + 8], [1, 0.88, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const tam = ios ? 62 : 58;
  const col = (i: number) => 26 + (i % 4) * 88;
  const fila = (i: number) => BAR + 40 + Math.floor(i / 4) * 104;
  const pos = 12; // el lugar del ícono nuevo
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: fuenteSistema,
      background: ios ? "radial-gradient(120% 80% at 20% 10%, #8FB8DE, #3C6E9E 55%, #1E3F63)" : "radial-gradient(120% 80% at 80% 0%, #A9C7E8, #5A86B8 50%, #2D4E78)" }}>
      {!ios && (
        <div style={{ position: "absolute", left: 22, top: BAR + 20, color: "#fff" }}>
          <div style={{ fontSize: 58, fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1 }}>19:05</div>
          <div style={{ fontSize: 15, opacity: 0.9, marginTop: 4 }}>vie, 27 nov</div>
        </div>
      )}
      {APPS.map((a, i) => {
        const j = ios ? i : i + 4;
        return (
          <div key={a.n} style={{ position: "absolute", left: col(j), top: fila(j) + (ios ? 0 : 60), width: 72, textAlign: "center" }}>
            <div style={{ width: tam, height: tam, margin: "0 auto", borderRadius: ios ? 15 : tam / 2, background: `linear-gradient(160deg, ${a.c}, ${a.c}cc)`, display: "grid", placeItems: "center", color: "#fff", fontSize: 26, boxShadow: "0 4px 10px rgba(0,0,0,.18)" }}>{a.g}</div>
            <div style={{ fontSize: 11.5, color: "#fff", marginTop: 6, textShadow: "0 1px 2px rgba(0,0,0,.4)" }}>{a.n}</div>
          </div>
        );
      })}
      {f >= aparece && (
        <div style={{ position: "absolute", left: col(ios ? pos : pos + 4), top: fila(ios ? pos : pos + 4) + (ios ? 0 : 60), width: 72, textAlign: "center", transform: `scale(${s * pulso})` }}>
          <Img src={staticFile(ios ? "marca/isotipo-pinche.svg" : "marca/isotipo-pinche-maskable.svg")} style={{ width: tam, height: tam, borderRadius: ios ? 15 : tam / 2, boxShadow: "0 6px 16px rgba(0,0,0,.3)" }} />
          <div style={{ fontSize: 11.5, color: "#fff", marginTop: 6, textShadow: "0 1px 2px rgba(0,0,0,.4)", fontWeight: 600 }}>Oído</div>
        </div>
      )}
      {/* dock */}
      <div style={{ position: "absolute", left: ios ? 14 : 0, right: ios ? 14 : 0, bottom: ios ? 18 : 28, height: ios ? 86 : 74, borderRadius: ios ? 30 : 0, background: ios ? "rgba(255,255,255,.28)" : "transparent", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
        {["#4CAF7A", "#5C8DF6", "#E3655B", "#7C8794"].map((c, i) => <div key={i} style={{ width: tam, height: tam, borderRadius: ios ? 15 : tam / 2, background: c, opacity: 0.95 }} />)}
      </div>
      {ios ? <div style={{ position: "absolute", left: 128, bottom: 6, width: 134, height: 5, borderRadius: 3, background: "#fff" }} /> : <AndroidGestos oscuro />}
    </div>
  );
};
export const iconoNuevo = (ios: boolean) => {
  const j = ios ? 12 : 16;
  return { x: 26 + (j % 4) * 88 + 36, y: 40 + Math.floor(j / 4) * 104 + (ios ? 0 : 60) + (ios ? 31 : 29) };
};

// La app que se abre desde el ícono: crece desde su lugar a pantalla completa, sin barras del navegador.
export const AppAbre: React.FC<{ desde: number; ios?: boolean }> = ({ desde, ios }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < desde) return null;
  const s = spring({ frame: f - desde, fps, config: { damping: 24, stiffness: 110 } });
  const ic = iconoNuevo(!!ios);
  const c = cap("l-landing-app");
  const e = 0.155 + 0.845 * s;
  // el centro viaja del ícono al centro de la pantalla
  const cx = ic.x + (195 - ic.x) * s, cy = ic.y + BAR + ((844 + BAR) / 2 - ic.y - BAR) * s;
  return (
    <div style={{ position: "absolute", left: cx - 195, top: cy - (844 + BAR) / 2, width: 390, height: 844 + BAR, zIndex: 35, overflow: "hidden",
      transform: `scale(${e})`, borderRadius: 60 * (1 - s) + 8, opacity: Math.min(1, s * 4), background: "#5BA8E0" }}>
      <Img src={staticFile(c.f)} style={{ position: "absolute", left: 0, top: BAR, width: 390, height: 844, opacity: interpolate(s, [0.15, 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
      <Img src={staticFile(ios ? "marca/isotipo-pinche.svg" : "marca/isotipo-pinche-maskable.svg")} style={{ position: "absolute", left: 95, top: 322, width: 200, height: 200, opacity: interpolate(s, [0, 0.4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
    </div>
  );
};

// ── Safari (iPhone) ─────────────────────────────────────────────────
export const SafariAbajo: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: BAR + 720, width: 390, height: 124, background: "rgba(248,248,250,.97)", zIndex: 20, fontFamily: fuenteSistema, borderTop: "0.5px solid rgba(0,0,0,.12)" }}>
    <div style={{ margin: "8px 12px 0", height: 46, borderRadius: 14, background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.12)", display: "flex", alignItems: "center", padding: "0 14px", justifyContent: "space-between", fontSize: 17, color: "#111" }}>
      <span style={{ fontWeight: 600, fontSize: 16 }}>aA</span>
      <span>oido.com.ar</span>
      {Ico.recargar("#111", 17)}
    </div>
    <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", height: 52 }}>
      {Ico.atras("#0A84FF", 24)}{Ico.adelante("#B8C4D0", 24)}{Ico.compartir("#0A84FF", 26)}{Ico.libro("#0A84FF", 24)}{Ico.pestanas("#0A84FF", 24)}
    </div>
    <div style={{ position: "absolute", left: 128, bottom: 6, width: 134, height: 5, borderRadius: 3, background: "#111" }} />
  </div>
);
export const SAFARI_COMPARTIR = { x: 195, y: 720 + 8 + 46 + 26 };

export const SafariSitio: React.FC = () => {
  const c = cap("l-landing-safari");
  return (
    <>
      <Img src={staticFile(c.f)} style={{ position: "absolute", left: 0, top: BAR, width: 390, height: (390 * c.h) / c.w }} />
      <SafariAbajo />
    </>
  );
};

const ACCIONES = ["Copiar", "Agregar a la lista de lectura", "Agregar marcador", "Agregar a favoritos", "Buscar en la página", "Agregar a inicio", "Marcar", "Imprimir"];
export const HOJA_TOP = 250; // donde arranca la hoja de Compartir (CSS de página)

export const SafariCompartir: React.FC<{ desde: number; hasta: number; scroll: [number, number]; resalta?: number }> = ({ desde, hasta, scroll, resalta }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < desde || f > hasta + 8) return null;
  const s = ent(f, desde, fps, { damping: 26, stiffness: 150 });
  const o = interpolate(f, [hasta, hasta + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sc = interpolate(f, scroll, [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.65, 0, 0.35, 1) }) * 200;
  const r = resalta !== undefined ? interpolate(f, [resalta, resalta + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30 }}>
      <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${0.25 * s * (1 - o)})` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: BAR + HOJA_TOP, bottom: 0, borderRadius: "14px 14px 0 0", background: "#F2F2F7", fontFamily: fuenteSistema,
        transform: `translateY(${(1 - s) * 620 + o * 620}px)`, boxShadow: "0 -6px 30px rgba(0,0,0,.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 14px", borderBottom: "0.5px solid rgba(0,0,0,.12)" }}>
          <Img src={staticFile("marca/isotipo-pinche-chico.svg")} style={{ width: 44, height: 44, borderRadius: 10 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>Oído</div>
            <div style={{ fontSize: 13, color: "#6b6b70" }}>oido.com.ar · Opciones ›</div>
          </div>
          <div style={{ width: 30, height: 30, borderRadius: 15, background: "#E3E3E8", display: "grid", placeItems: "center", color: "#6b6b70", fontSize: 16, fontWeight: 700 }}>✕</div>
        </div>
        <div style={{ transform: `translateY(${-sc}px)` }}>
          <div style={{ display: "flex", gap: 18, padding: "16px 16px 10px" }}>
            {["#7DB5E8", "#9BD3A8", "#F2C46C", "#C9A7E8"].map((c, i) => <div key={i} style={{ width: 62, height: 62, borderRadius: 15, background: c, opacity: 0.85 }} />)}
          </div>
          <div style={{ margin: "10px 14px", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
            {ACCIONES.map((t, i) => {
              const es = t === "Agregar a inicio";
              return (
                <div key={t} style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 17, color: "#111",
                  borderTop: i ? "0.5px solid rgba(0,0,0,.1)" : undefined, background: es ? `rgba(28,84,120,${0.12 * r})` : undefined, fontWeight: es && r > 0.5 ? 600 : 400 }}>
                  {t}
                  <span style={{ opacity: 0.85 }}>{es ? Ico.agregar("#111", 24) : <span style={{ display: "block", width: 18, height: 18, border: "1.8px solid #444", borderRadius: 5 }} />}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
// centro de «Agregar a inicio» en la página, ya con la hoja desplazada 200 px
export const SAFARI_AGREGAR_INICIO = { x: 195, y: HOJA_TOP + 73 + 88 + 10 + 5 * 50 + 25 - 200 };

export const SafariAgregar: React.FC<{ desde: number; hasta: number }> = ({ desde, hasta }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < desde || f > hasta + 8) return null;
  const s = ent(f, desde, fps, { damping: 26, stiffness: 150 });
  const o = interpolate(f, [hasta, hasta + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: BAR + 12, bottom: 0, borderRadius: "14px 14px 0 0", background: "#F2F2F7", zIndex: 32, fontFamily: fuenteSistema,
      transform: `translateY(${(1 - s) * 860 + o * 860}px)`, boxShadow: "0 -6px 30px rgba(0,0,0,.18)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 16px", fontSize: 17 }}>
        <span style={{ color: "#0A84FF" }}>Cancelar</span>
        <span style={{ fontWeight: 600, color: "#111" }}>Agregar a inicio</span>
        <span style={{ color: "#0A84FF", fontWeight: 600 }}>Agregar</span>
      </div>
      <div style={{ margin: "18px 16px 0", borderRadius: 12, background: "#fff", padding: 14, display: "flex", gap: 14, alignItems: "center" }}>
        <Img src={staticFile("marca/isotipo-pinche.svg")} style={{ width: 62, height: 62, borderRadius: 14 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, color: "#111", paddingBottom: 8, borderBottom: "0.5px solid rgba(0,0,0,.15)" }}>Oído</div>
          <div style={{ fontSize: 15, color: "#8a8a8e", paddingTop: 8 }}>https://www.oido.com.ar/</div>
        </div>
      </div>
      <div style={{ margin: "10px 30px", fontSize: 13, color: "#6b6b70", lineHeight: 1.35 }}>Se agregará un ícono a tu pantalla de inicio para que puedas acceder rápidamente a este sitio web.</div>
    </div>
  );
};
export const SAFARI_BOTON_AGREGAR = { x: 350, y: 12 + 16 + 11 };
