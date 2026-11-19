/**
 * El banco de nubes de la landing: abre la página (el inicio, HeroRueda.tsx)
 * y la cierra (el final, LandingFooter.tsx). Va dibujado con un filtro de
 * ruido para que el borde no sea un óvalo borroso. Es un SVG quieto, que sale
 * en el HTML del servidor; el `id` distingue los filtros de cada copia.
 */
export default function BancoDeNubes({ id, className }: { id: string; className?: string }) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 1440 460" preserveAspectRatio="xMidYMax slice">
      <defs>
        <filter id={`${id}-nube`} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves={5} seed={11} result="ruido" />
          <feDisplacementMap in="SourceGraphic" in2="ruido" scale={95} xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation={4} />
        </filter>
        <filter id={`${id}-bruma`} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves={3} seed={4} result="ruido" />
          <feDisplacementMap in="SourceGraphic" in2="ruido" scale={120} xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation={22} />
        </filter>
        <linearGradient id={`${id}-luz`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e3f0f8" />
        </linearGradient>
      </defs>
      <g filter={`url(#${id}-bruma)`} fill="#ffffff" opacity={0.6}>
        <ellipse cx={720} cy={470} rx={900} ry={130} />
      </g>
      <g filter={`url(#${id}-nube)`} fill={`url(#${id}-luz)`}>
        <ellipse cx={60} cy={360} rx={250} ry={110} />
        <ellipse cx={270} cy={420} rx={240} ry={90} />
        <ellipse cx={0} cy={250} rx={130} ry={84} />
        <ellipse cx={1390} cy={350} rx={250} ry={114} />
        <ellipse cx={1190} cy={420} rx={240} ry={86} />
        <ellipse cx={1440} cy={230} rx={130} ry={88} />
        <ellipse cx={720} cy={460} rx={360} ry={60} />
      </g>
    </svg>
  );
}
