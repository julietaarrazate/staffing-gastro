import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { PushPromptProvider } from "@/lib/push-prompt-context";
import { ToastProvider } from "@/components/ui";
import SplashScreen from "@/components/SplashScreen";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  themeColor: "#ff6b00",
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
  // La app sólo diseña modo claro (fuera de alcance implementar dark mode
  // real, ver docs/PULIDO_ROADMAP.md batch C0 #1). Sin esto, el auto-dark de
  // Chrome Android puede invertir los colores de la página creyendo que no
  // declaramos ningún esquema soportado. `color-scheme: light` ya estaba en
  // `globals.css`; esto lo refuerza a nivel de metadata del layout raíz.
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-ink">
        <AuthProvider>
          <ToastProvider>
            <PushPromptProvider>
              <SplashScreen />
              <Navbar />
              <main className="flex-1 pb-20 md:pb-0">{children}</main>
              <BottomNav />
            </PushPromptProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
