export default function Logo({
  size = 28,
  withWordmark = true,
}: {
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Staffya"
      >
        <defs>
          <linearGradient
            id="logoGrad"
            x1="0"
            y1="0"
            x2="0"
            y2="512"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#f97316" />
            <stop offset="1" stopColor="#ea580c" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="113" fill="url(#logoGrad)" />
        <path d="M294 44 L136 287 H233 L202 468 L376 202 H266 Z" fill="#ffffff" />
      </svg>
      {withWordmark && (
        <span className="text-xl font-extrabold tracking-tight text-zinc-900">
          Staff<span className="text-orange-600">ya</span>
        </span>
      )}
    </span>
  );
}
