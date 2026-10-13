import Link from "next/link";
import { LogoMark } from "@/components/Logo";

/** El pie, en la misma noche del cierre. Los links de registro van con su
 *  rol (antes "Crear cuenta" abría la pestaña de trabajador por defecto,
 *  también a los comercios). */
export default function LandingFooter() {
  return (
    <footer data-tone="night" className="border-t border-white/10 bg-night px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-14 text-white sm:px-6 lg:px-12">
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className="no-select inline-flex items-center gap-2">
            <LogoMark size={28} />
            <span className="font-serif text-xl font-semibold tracking-tight text-white">oído</span>
          </span>
          <p className="mt-3 font-display text-h2 font-medium text-manteca">Personal gastronómico, ya</p>
        </div>
        <nav aria-label="Pie" className="grid grid-cols-2 gap-x-10 gap-y-3 text-body text-white/75 sm:grid-cols-3">
          <Link href="/login" className="hover:text-white">Ingresar</Link>
          <Link href="/register?rol=comercio" data-cta="footer" className="hover:text-white">Para comercios</Link>
          <Link href="/#trabajar" data-cta="footer-trabajo" className="hover:text-white">Para trabajadores</Link>
          <Link href="/#precios" className="hover:text-white">Precios</Link>
          <Link href="/#preguntas" className="hover:text-white">Preguntas frecuentes</Link>
          <Link href="/terminos" className="hover:text-white">Términos</Link>
          <Link href="/privacidad" className="hover:text-white">Privacidad</Link>
        </nav>
      </div>
      <p className="mt-12 text-caption text-white/60">© 2026 Julieta Arrazate — Oído. Hecho en Argentina.</p>
    </footer>
  );
}
