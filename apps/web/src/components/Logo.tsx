export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
            <stop stopColor="#2dd4bf" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#lg)" strokeWidth="2" />
        <path d="M10 9v14h9" stroke="url(#lg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="21" cy="12" r="2.4" fill="#2dd4bf" />
      </svg>
      <span className="text-text">
        Lunatic<span className="text-accent"> Pentest</span>
      </span>
    </span>
  );
}
