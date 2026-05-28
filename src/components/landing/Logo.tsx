type LogoProps = {
  /** Hauteur du pictogramme en pixels. */
  size?: number;
  /** Couleur du wordmark (le picto garde toujours son gradient). */
  tone?: "dark" | "light";
};

export default function Logo({ size = 28, tone = "dark" }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 72 72"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="collabbs-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <rect width="72" height="72" rx="16" fill="url(#collabbs-logo)" />
        <circle cx="28" cy="36" r="14" fill="white" />
        <circle cx="44" cy="36" r="14" fill="white" fillOpacity="0.55" />
      </svg>
      <span
        className={`font-display text-xl font-extrabold tracking-tight ${
          tone === "light" ? "text-white" : "text-ink"
        }`}
      >
        colla<span className="text-brand">bb</span>s
      </span>
    </span>
  );
}
