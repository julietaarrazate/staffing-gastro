import { describe, expect, it, vi } from "vitest";
import { syncCamera, syncCooperativeGestures, syncInteractiveHandlers } from "./MapView";

/**
 * Regresión real (reporte de Julieta, 2026-08-14: "arreglé que no se mueva
 * el mapa... y ahora se vuelve a mover"): `cooperativeGestures` es una
 * opción de CONSTRUCTOR de maplibre-gl — con `reuseMaps`, un mapa reciclado
 * del pool estático conserva el `cooperativeGestures` con el que se
 * construyó la PRIMERA vez, sin importar lo que diga el prop del montaje
 * actual. `syncInteractiveHandlers` ya resolvía este problema para
 * `interactive`; `syncCooperativeGestures` es el mismo mecanismo aplicado al
 * handler que faltaba.
 */
function fakeMap() {
  return {
    scrollZoom: { enable: vi.fn(), disable: vi.fn() },
    boxZoom: { enable: vi.fn(), disable: vi.fn() },
    dragRotate: { enable: vi.fn(), disable: vi.fn() },
    dragPan: { enable: vi.fn(), disable: vi.fn() },
    keyboard: { enable: vi.fn(), disable: vi.fn() },
    doubleClickZoom: { enable: vi.fn(), disable: vi.fn() },
    touchZoomRotate: { enable: vi.fn(), disable: vi.fn() },
    touchPitch: { enable: vi.fn(), disable: vi.fn() },
    cooperativeGestures: { enable: vi.fn(), disable: vi.fn() },
    jumpTo: vi.fn(),
  };
}

describe("syncCooperativeGestures", () => {
  it("habilita el handler cuando el mapa reciclado debería exigir dos dedos", () => {
    const map = fakeMap();
    syncCooperativeGestures(map, true);
    expect(map.cooperativeGestures.enable).toHaveBeenCalledOnce();
    expect(map.cooperativeGestures.disable).not.toHaveBeenCalled();
  });

  it("deshabilita el handler para mapas de pantalla completa (/map, /search)", () => {
    const map = fakeMap();
    syncCooperativeGestures(map, false);
    expect(map.cooperativeGestures.disable).toHaveBeenCalledOnce();
    expect(map.cooperativeGestures.enable).not.toHaveBeenCalled();
  });

  it("no explota si el mapa reciclado no expone el handler", () => {
    expect(() => syncCooperativeGestures({}, true)).not.toThrow();
  });
});

/**
 * Regresión real, reportada dos veces por Julieta ("el mapa sigue sin apuntar
 * a la geolocalización en la que estoy", 2026-08-16 y 2026-08-17): tercera
 * consecuencia del mismo `reuseMaps`. `initialViewState` sólo se aplica al
 * CONSTRUIR el mapa, así que uno reciclado del pool abre con la cámara del
 * montaje anterior — `/map` y `/search` mostrando el centro por defecto
 * aunque la geolocalización ya hubiera resuelto, y el mini-mapa de una
 * tarjeta mostrando la zona del turno anterior.
 */
describe("syncCamera", () => {
  it("salta al centro pedido, convirtiendo [lat,lng] al [lng,lat] de maplibre", () => {
    const map = fakeMap();
    syncCamera(map, [-34.6037, -58.3816], 14);
    expect(map.jumpTo).toHaveBeenCalledWith({ center: [-58.3816, -34.6037], zoom: 14 });
  });

  it("respeta el zoom de cada consumidor (MiniMap 14, /search 13)", () => {
    const map = fakeMap();
    syncCamera(map, [-34.58, -58.42], 13);
    expect(map.jumpTo).toHaveBeenCalledWith({ center: [-58.42, -34.58], zoom: 13 });
  });

  it("no explota si el mapa reciclado todavía no expone jumpTo", () => {
    expect(() => syncCamera({}, [-34.6, -58.38], 14)).not.toThrow();
  });
});

describe("syncInteractiveHandlers", () => {
  it("habilita los 8 handlers de gesto cuando interactive=true", () => {
    const map = fakeMap();
    syncInteractiveHandlers(map, true);
    expect(map.dragPan.enable).toHaveBeenCalledOnce();
    expect(map.scrollZoom.enable).toHaveBeenCalledOnce();
    expect(map.touchZoomRotate.enable).toHaveBeenCalledOnce();
    // No es responsabilidad de este sync — cooperativeGestures tiene el suyo
    // propio (arriba), justamente porque son handlers independientes.
    expect(map.cooperativeGestures.enable).not.toHaveBeenCalled();
  });

  it("deshabilita los 8 handlers de gesto cuando interactive=false (MiniMap)", () => {
    const map = fakeMap();
    syncInteractiveHandlers(map, false);
    expect(map.dragPan.disable).toHaveBeenCalledOnce();
    expect(map.scrollZoom.disable).toHaveBeenCalledOnce();
  });
});
