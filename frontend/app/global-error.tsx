"use client";

/**
 * Último recurso: errores del layout raíz (`app/layout.tsx`), donde `error.tsx`
 * no llega. Reemplaza al layout entero, así que lleva su propio `<html><body>`
 * y no depende de proveedores, tokens ni componentes de la app: estilos en
 * línea con colores que se leen en claro y en oscuro (`color-scheme`).
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-AR">
      <body style={{ margin: 0, colorScheme: "light dark", fontFamily: "system-ui, sans-serif" }}>
        <main
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 24 }}>Algo salió mal</h1>
          <p style={{ margin: 0, maxWidth: 360, opacity: 0.75 }}>
            Tuvimos un problema al abrir la app. Probá de nuevo; si sigue igual, volvé en unos minutos.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 8,
              minHeight: 48,
              padding: "0 24px",
              borderRadius: 14,
              border: 0,
              fontSize: 16,
              fontWeight: 700,
              background: "#d97706",
              color: "#111",
              cursor: "pointer",
            }}
          >
            Probar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
