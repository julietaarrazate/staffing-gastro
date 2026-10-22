# supercluster 8 → 9.1 en el mapa de turnos

**Pedido:** Julieta, 2026-10-21, actualizaciones grandes: subir `supercluster`
de `^8.0.1` a `^9.1.0` sin cambiar cómo se agrupan los pines.

**Qué cambió:** para el usuario, nada: el mapa agrupa y separa los pines igual
(mismo `radius` 52 px y `maxZoom` 17). Lo técnico:

- `frontend/package.json` / `package-lock.json`: `supercluster` `^9.1.0` y se
  saca `@types/supercluster`, porque la 9.1 trae sus propios tipos
  (`index.d.ts`).
- `frontend/lib/map/clustering.ts`: los tipos ahora son exports con nombre
  (`import { type PointFeature, type ClusterFeature } from "supercluster"`)
  en vez de `Supercluster.PointFeature` del namespace de `@types`.
- `frontend/lib/map/clustering.test.ts` (nuevo): no había test del agrupado.
  Tres turnos a ~50 m se juntan en un cluster de 3 en zoom 10, se separan en
  zoom 18, el turno lejano queda suelto, el de sin coordenadas se descarta y
  el zoom de expansión abre el cluster en sus 3 turnos.

**Por qué así:** según las notas de versión, la 9.0 no cambia la API
(mejora memoria/velocidad, suma `MultiPoint` y limita `maxZoom` a 30; usamos
17) y la 9.1 suma `getTileRaw` (no lo usamos) y trae los tipos. La 9 es ESM
puro (`"type": "module"`); el import por defecto ya era ESM y Next/OpenNext lo
empaquetan sin cambios.

**Queda abierto:** nada de esta actualización. Al correr la suite unitaria
varias veces, `components/GoogleAuthButton.test.tsx` ("no deja elegir el rol
sin aceptar términos y privacidad") cortó por tiempo (5 s) en 2 de 5 corridas
con la máquina cargada; no tiene que ver con este cambio.
