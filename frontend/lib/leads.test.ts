import { describe, expect, it } from "vitest";
import {
  instagramHref,
  leadsToCsv,
  mapsHref,
  osmHref,
  priorityLabel,
  websiteHref,
} from "./leads";
import type { Lead } from "./types";

const lead: Lead = {
  id: "1",
  osm_ref: "node/10",
  name: 'Bar "La Cueva"',
  kind: "bar",
  barrio: "Palermo",
  latitude: -34.58,
  longitude: -58.42,
  address: "Thames 1500",
  phone: "+54 11 4000-0000",
  website: "lacueva.com.ar",
  instagram: "@lacueva",
  email: null,
  status: "interesado",
  notes: "Volver el martes, habló con Ana",
  priority: 5,
  contacted_at: null,
  updated_at: null,
};

describe("priorityLabel", () => {
  it("agrupa la prioridad en tres niveles", () => {
    expect(priorityLabel(5)).toBe("Alta");
    expect(priorityLabel(4)).toBe("Alta");
    expect(priorityLabel(3)).toBe("Media");
    expect(priorityLabel(1)).toBe("Baja");
  });
});

describe("links", () => {
  it("completa la web con https y descarta esquemas peligrosos", () => {
    expect(websiteHref("lacueva.com.ar")).toBe("https://lacueva.com.ar/");
    expect(websiteHref("http://lacueva.com.ar")).toBe("https://lacueva.com.ar/");
    expect(websiteHref("javascript:alert(1)")).toBeNull();
    expect(websiteHref(null)).toBeNull();
  });

  it("arma el link de Instagram desde un usuario o una URL", () => {
    expect(instagramHref("@lacueva")).toBe("https://www.instagram.com/lacueva/");
    expect(instagramHref("lacueva")).toBe("https://www.instagram.com/lacueva/");
    expect(instagramHref("https://instagram.com/lacueva")).toBe("https://instagram.com/lacueva");
    expect(instagramHref("no es un usuario")).toBeNull();
  });

  it("apunta a Maps y a la ficha de OpenStreetMap", () => {
    expect(mapsHref(lead)).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(osmHref("way/20")).toBe("https://www.openstreetmap.org/way/20");
  });
});

describe("leadsToCsv", () => {
  it("escapa comillas y comas, y neutraliza fórmulas", () => {
    const csv = leadsToCsv([lead]);
    expect(csv.startsWith("﻿Nombre,Rubro,Barrio")).toBe(true);
    const row = csv.split("\n")[1];
    expect(row).toContain('"Bar ""La Cueva"""');
    expect(row).toContain("'+54 11 4000-0000");
    expect(row).toContain('"Volver el martes, habló con Ana"');
    expect(row).toContain("Interesado");
  });
});
