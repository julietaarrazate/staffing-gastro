# El isotipo pasa a blanco sobre azul hondo (#PR)

**Pedido:** Julieta, 2026-10-19. Al abrir la app instalada, Android muestra
un instante el ícono de la app (eso no lo controla la web), y era el
isotipo crema sobre ámbar: "desentona con lo nuevo". Se probó cambiar el
ícono por el «oído» fileteado y por la palabra plana con la tilde ámbar;
decidió dejar el isotipo de siempre hasta tener uno nuevo, pero en los
colores actuales. Entre azul hondo sobre cielo, crema sobre noche azul y
blanco sobre azul hondo, eligió **blanco sobre azul hondo**.

**Qué ve el usuario:** el ícono de la app (pantalla del celular, arranque
en Android, iPhone, pestaña del navegador) y el logo chico del encabezado
dentro de la app pasan a la mano y la oreja en blanco sobre `#1C5478`.

**Qué cambió (técnico):** `public/logo-mark.svg`, `logo-maskable.svg` y
`logo.svg` cambian `#d97706` → `#1c5478` y `#fff6ee` → `#ffffff`; los PNG y
el `favicon.ico` se regeneraron con `node scripts/build-icons.mjs`.
Comentario de `components/Logo.tsx` y `docs/design-system/marca-hoy.md`
actualizados.

**Ojo:** en un celular con la app ya instalada, el ícono nuevo aparece al
desinstalarla y volver a instalarla (Android actualiza solo, pero puede
tardar días).
