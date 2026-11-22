// Historias en loop (6–10 s), salen de los videos largos. El chip de abajo lleva la cuenta.
import type { Sonido } from "../kit/sonido";

export type DatosHistoria = { id: string; titulo: string[]; acento?: string; cuenta: "@oidoapp" | "@turnosgastro"; duracion: number; sonido: Sonido };

export const historias = {
  comercios: { id: "historia-comercios", titulo: ["Elegís", "y ¡oído!"], acento: "¡oído!", cuenta: "@oidoapp", duracion: 210,
    sonido: { murmullo: true, cues: [["toque", 52, -4], ["campanita", 75, -3]] } },
  trabajadores: { id: "historia-trabajadores", titulo: ["Hay turno", "a la vuelta."], acento: "vuelta.", cuenta: "@turnosgastro", duracion: 210,
    sonido: { murmullo: true, cues: [["toque", 44, -4]] } },
  match: { id: "historia-match", titulo: ["No elijas", "a ciegas."], acento: "ciegas.", cuenta: "@oidoapp", duracion: 210,
    sonido: { murmullo: true, cues: [["toque", 20, -9], ["toque", 44, -9], ["toque", 68, -9], ["toque", 92, -9]] } },
  instalarAndroid: { id: "historia-instalar-android", titulo: [], cuenta: "@oidoapp", duracion: 300,
    sonido: { murmullo: false, cues: [["toque", 40, -3], ["toque", 132, -3], ["toque", 216, -3], ["toque", 270, -3]] } },
  instalarIphone: { id: "historia-instalar-iphone", titulo: [], cuenta: "@oidoapp", duracion: 300,
    sonido: { murmullo: false, cues: [["toque", 40, -3], ["toque", 140, -3], ["toque", 216, -3], ["toque", 270, -3]] } },
} satisfies Record<string, DatosHistoria>;
