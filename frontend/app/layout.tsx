import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, Hanken_Grotesk, DM_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import { PushPromptProvider } from "@/lib/push-prompt-context";
import { ToastProvider } from "@/components/ui";
import SplashScreen from "@/components/SplashScreen";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import ImpersonationBanner from "@/components/ImpersonationBanner";

// Inter: texto e interfaz (spec del diseñador). Reemplaza a Geist como sans
// por defecto de toda la app.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Fraunces: serif SÓLO para el wordmark "Oído" (el logo del board es serif).
// Ya NO es la fuente de los títulos de UI — se expone como `font-serif` y la
// consume el componente Logo. Los títulos pasan a Saans (abajo).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Saans (board v5.0): tipografía de TÍTULOS/UI. Saans es una fuente PAGA
// (displaay foundry) que no se puede cargar desde Google Fonts; hasta que
// Julieta decida licenciarla, este es un STAND-IN LIBRE — Hanken Grotesk, un
// grotesco humanista cercano en tono. Se expone como `--font-saans` →
// utilidad `font-display`. Al licenciar Saans, se cambia sólo este import.
const saans = Hanken_Grotesk({
  variable: "--font-saans",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

// DM Mono (board v5.0): datos y precios — el precio de un turno, horarios,
// métricas. Reemplaza a Space Mono. Se expone como `font-mono`.
const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const TAGLINE = "Personal gastronómico, ya.";
const DESCRIPTION =
  "Publicás un turno y en minutos tenés candidatos rankeados por cercanía y reputación.";

export const metadata: Metadata = {
  metadataBase: new URL("https://staffya.com.ar"),
  title: { default: `oído — ${TAGLINE}`, template: "%s — Oído" },
  description: DESCRIPTION,
  applicationName: "Oído",
  appleWebApp: {
    capable: true,
    title: "Oído",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: `oído — ${TAGLINE}`,
    description: DESCRIPTION,
    siteName: "Oído",
    locale: "es_AR",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: TAGLINE }],
  },
  twitter: {
    card: "summary_large_image",
    title: `oído — ${TAGLINE}`,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#d97706",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // SIN esto, `env(safe-area-inset-*)` vale SIEMPRE 0 en iOS y todo el código
  // de safe-area del repo queda muerto: la barra inferior se dibuja debajo
  // del indicador de home del iPhone y el último tab queda medio tapado.
  // `cover` es lo que hace que la página use el alto real de la pantalla y
  // que iOS reporte los insets del notch/indicador (lo que ya consumen
  // `BottomNav`, `Sheet` y las utilidades `.safe-*` de globals.css).
  viewportFit: "cover",
  // La app ahora soporta claro / oscuro / sistema (ver lib/theme.tsx +
  // globals.css). Declaramos ambos esquemas para que el navegador respete
  // nuestro theming en vez de auto-invertir; el modo concreto lo fija
  // `data-theme` en <html> y los tokens de globals.css.
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${fraunces.variable} ${saans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-ink">
        {/* Anti-flash: fija data-theme antes del primer paint según la
            preferencia guardada, para que la app no salga en claro y salte a
            oscuro al hidratar. Ver lib/theme.tsx. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <PushPromptProvider>
                <SplashScreen />
                <ImpersonationBanner />
                <Navbar />
                {/* Sin botones flotantes globales (Julieta, 2026-08-16: "no
                    quiero botones flotantes") — el asistente vive en
                    AIAssistantBar, el punto de entrada fijo de /shifts
                    (comercio) y /feed (trabajador), no en una cápsula suelta
                    sobre el resto de las pantallas. */}
                {/* `pb-[var(--chrome-bottom)]`, no `pb-20`: BottomNav le suma su
                    propio `env(safe-area-inset-bottom)` a los 80px base (mismo
                    token `--chrome-bottom` que ya usan las páginas con
                    `min-h-[calc(100dvh-var(--chrome-top)-var(--chrome-bottom))]`)
                    — con el `pb-20` fijo, el contenido con scroll quedaba corto
                    en un iPhone con home indicator y el final se tapaba
                    parcialmente detrás de la barra. Donde el inset vale 0 (todo
                    dispositivo sin notch, y cualquier entorno de test) el
                    cálculo da exactamente 5rem = 80px, igual que antes. */}
                <main className="flex-1 pb-[var(--chrome-bottom)] md:pb-0">{children}</main>
                <BottomNav />
              </PushPromptProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
