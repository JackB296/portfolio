// Drawn, front-facing poster art for each film grade: one minimal iconic
// composition per film, in that film's palette, with the title set at the
// bottom. These stand in until a real poster file is added via the grade's
// `poster` field (see lib/grades.ts).

function Title({
  text,
  year,
  color,
  serif = false,
}: {
  text: string;
  year: string;
  color: string;
  serif?: boolean;
}) {
  const family = serif
    ? "Georgia, 'Times New Roman', serif"
    : "var(--font-mono), ui-monospace, monospace";
  const size = text.length > 16 ? 8 : text.length > 11 ? 9.5 : 11;
  return (
    <>
      <text
        x="60"
        y="158"
        textAnchor="middle"
        fontFamily={family}
        fontSize={size}
        letterSpacing="0.5"
        fontWeight="700"
        fill={color}
      >
        {text.toUpperCase()}
      </text>
      <text
        x="60"
        y="170"
        textAnchor="middle"
        fontFamily="var(--font-mono), ui-monospace, monospace"
        fontSize="7"
        fill={color}
        opacity="0.55"
      >
        {year}
      </text>
    </>
  );
}

/** id → 120x180 SVG poster. Falls back to a plain palette card. */
export default function PosterArt({
  id,
  film,
  year,
  ink,
  accent,
}: {
  id: string;
  film: string;
  year: string;
  ink: string;
  accent: string;
}) {
  const bg = `rgb(${ink})`;
  const fg = `rgb(${accent})`;

  const art = (() => {
    switch (id) {
      case "house":
        return (
          <>
            {/* A glider, in the hero's real cell colors */}
            <g>
              <rect x="52" y="46" width="14" height="14" rx="2" fill="#34d399" />
              <rect x="68" y="62" width="14" height="14" rx="2" fill="#38bdf8" />
              <rect x="36" y="78" width="14" height="14" rx="2" fill="#38bdf8" />
              <rect x="52" y="78" width="14" height="14" rx="2" fill="#a78bfa" />
              <rect x="68" y="78" width="14" height="14" rx="2" fill="#f472b6" />
            </g>
          </>
        );
      case "casablanca":
        return (
          <>
            <rect x="0" y="0" width="120" height="130" fill="#1c1c1e" />
            {/* Searchlights over the airfield */}
            <polygon points="14,120 44,20 58,20" fill="#e4e4e7" opacity="0.14" />
            <polygon points="106,120 78,26 64,26" fill="#e4e4e7" opacity="0.1" />
            {/* Plane silhouette */}
            <g fill="#09090b">
              <ellipse cx="60" cy="96" rx="26" ry="4" />
              <polygon points="48,96 66,80 72,82 58,96" />
              <polygon points="60,96 84,104 78,94" />
              <rect x="82" y="92" width="8" height="2.5" rx="1" />
            </g>
            <rect x="0" y="118" width="120" height="14" fill="#0c0c0d" />
          </>
        );
      case "matrix":
        return (
          <>
            <g fill="#22c55e" fontFamily="var(--font-mono), monospace" fontSize="7" fontWeight="700">
              {["10110101", "01101011", "11001010", "00110101", "10101100", "01011011", "11100101"].map(
                (stream, column) => (
                  <text key={stream} opacity={0.28 + (column % 3) * 0.18}>
                    {stream.split("").map((digit, row) => (
                      <tspan key={row} x={10 + column * 16} y={12 + row * 15}>
                        {digit}
                      </tspan>
                    ))}
                  </text>
                )
              )}
            </g>
            <path d="M36 48 Q60 32 84 48 V92 Q60 116 36 92 Z" fill="#020703" opacity="0.78" />
            <path d="M45 62 Q60 51 75 62" fill="none" stroke="#4ade80" strokeWidth="1.5" opacity="0.75" />
          </>
        );
      case "blade-runner":
        return (
          <>
            <circle cx="60" cy="72" r="34" fill="#f9a8d4" opacity="0.9" />
            <circle cx="60" cy="72" r="34" fill="none" stroke="#ec4899" strokeWidth="2" />
            {/* City bars in front of the sun */}
            <g fill="#0b0716">
              <rect x="8" y="88" width="12" height="44" />
              <rect x="24" y="76" width="10" height="56" />
              <rect x="38" y="94" width="14" height="38" />
              <rect x="56" y="82" width="9" height="50" />
              <rect x="69" y="98" width="13" height="34" />
              <rect x="86" y="72" width="11" height="60" />
              <rect x="101" y="90" width="12" height="42" />
            </g>
          </>
        );
      case "space-odyssey":
        return (
          <>
            {/* Monolith under an aligned sun */}
            <circle cx="60" cy="34" r="8" fill="#dc2626" />
            <rect x="59" y="42" width="2" height="10" fill="#dc2626" opacity="0.4" />
            <rect x="44" y="54" width="32" height="76" fill="#000" stroke="#27272a" strokeWidth="1" />
            <rect x="0" y="130" width="120" height="2" fill="#3f3f46" />
          </>
        );
      case "dune":
        return (
          <>
            <circle cx="83" cy="27" r="12" fill="#fef3c7" opacity="0.9" />
            <circle cx="100" cy="42" r="5" fill="#fde68a" opacity="0.65" />
            <path d="M0 84 Q42 48 120 86 V140 H0 Z" fill="#b45309" />
            <path d="M0 103 Q54 70 120 102 V140 H0 Z" fill="#92400e" />
            <path d="M0 122 Q62 92 120 118 V142 H0 Z" fill="#78350f" />
            <path d="M20 99 Q42 75 70 94" stroke="#451a03" strokeWidth="2" fill="none" />
            <path d="M18 104 Q42 82 68 99" stroke="#f59e0b" strokeWidth="0.8" fill="none" opacity="0.55" />
            <g fill="#1c0a02">
              <rect x="59" y="83" width="2" height="15" rx="1" />
              <circle cx="60" cy="80" r="2.2" />
              <path d="M59 88 L51 96 H56 L61 91 Z" />
            </g>
          </>
        );
      case "the-batman":
        return (
          <>
            <rect x="0" y="0" width="120" height="180" fill="#0a0506" />
            <circle cx="60" cy="70" r="30" fill="#e11d48" opacity="0.22" />
            <circle cx="60" cy="70" r="18" fill="#e11d48" opacity="0.3" />
            <path
              d="M24 70 L38 61 L49 66 L55 54 L60 63 L65 54 L71 66 L82 61 L96 70 L78 74 L68 84 L60 78 L52 84 L42 74 Z"
              fill="#e11d48"
              opacity="0.82"
            />
            {/* Rain */}
            <g stroke="#e11d48" strokeWidth="1" opacity="0.35">
              <line x1="22" y1="14" x2="16" y2="34" />
              <line x1="52" y1="8" x2="46" y2="28" />
              <line x1="88" y1="16" x2="82" y2="36" />
              <line x1="104" y1="40" x2="98" y2="60" />
              <line x1="30" y1="96" x2="24" y2="116" />
              <line x1="96" y1="100" x2="90" y2="120" />
            </g>
            <rect x="0" y="120" width="120" height="14" fill="#000" />
          </>
        );
      case "parasite":
        return (
          <>
            {/* The glass house window up top, the stairs going down */}
            <rect x="18" y="22" width="84" height="30" fill="none" stroke="#2dd4bf" strokeWidth="1.5" opacity="0.8" />
            <line x1="46" y1="22" x2="46" y2="52" stroke="#2dd4bf" strokeWidth="1" opacity="0.5" />
            <line x1="74" y1="22" x2="74" y2="52" stroke="#2dd4bf" strokeWidth="1" opacity="0.5" />
            <path
              d="M84 70 H70 V84 H56 V98 H42 V112 H28 V126"
              fill="none"
              stroke="#14b8a6"
              strokeWidth="2"
            />
          </>
        );
      case "arrival":
        return (
          <>
            <rect x="0" y="0" width="120" height="180" fill="#0f1319" />
            <ellipse cx="60" cy="62" rx="20" ry="44" fill="#1e2833" transform="rotate(8 60 62)" />
            <ellipse cx="60" cy="62" rx="20" ry="44" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5" transform="rotate(8 60 62)" />
            <rect x="0" y="118" width="120" height="10" fill="#334155" opacity="0.35" />
            <rect x="0" y="126" width="120" height="6" fill="#334155" opacity="0.2" />
          </>
        );
      case "fury-road":
        return (
          <>
            <circle cx="60" cy="52" r="26" fill="#fdba74" opacity="0.9" />
            <rect x="0" y="86" width="120" height="46" fill="#431407" />
            {/* Road converging into the storm */}
            <polygon points="52,132 68,132 63,86 57,86" fill="#f97316" opacity="0.8" />
            <line x1="12" y1="132" x2="46" y2="90" stroke="#9a3412" strokeWidth="2" />
            <line x1="108" y1="132" x2="74" y2="90" stroke="#9a3412" strokeWidth="2" />
          </>
        );
      case "her":
        return (
          <>
            <rect x="0" y="0" width="120" height="180" fill="#e35d5b" />
            <circle cx="60" cy="58" r="34" fill="#be123c" opacity="0.18" />
            <path
              d="M42 96 C30 82 31 57 42 40 C50 28 69 25 78 37 C67 39 62 46 63 57 C64 70 57 76 48 78 L50 96 Z"
              fill="#fff1f2"
              opacity="0.82"
            />
            <g fill="none" stroke="#fff1f2" strokeLinecap="round" opacity="0.7">
              <path d="M76 53 Q88 62 76 71" strokeWidth="1.5" />
              <path d="M82 47 Q100 62 82 77" strokeWidth="1" />
            </g>
          </>
        );
      case "wall-e":
        return (
          <>
            {/* The little robot and his plant */}
            <g>
              <rect x="42" y="68" width="28" height="24" rx="3" fill="#a16207" />
              <rect x="40" y="92" width="32" height="8" rx="2" fill="#3f3f2e" />
              <rect x="46" y="56" width="8" height="9" rx="4" fill="#67e8f9" />
              <rect x="58" y="56" width="8" height="9" rx="4" fill="#67e8f9" />
              <rect x="50" y="64" width="12" height="4" fill="#713f12" />
            </g>
            <path d="M88 96 Q 88 84 96 80 M88 96 Q 88 86 80 82" stroke="#4ade80" strokeWidth="2" fill="none" />
            <line x1="88" y1="96" x2="88" y2="102" stroke="#4ade80" strokeWidth="2" />
            <rect x="0" y="100" width="120" height="3" fill="#57534e" />
          </>
        );
      case "royal-tenenbaums":
        return (
          <>
            <rect x="0" y="0" width="120" height="180" fill="#ca8a04" />
            {/* The tracksuit stripes */}
            <rect x="20" y="0" width="7" height="180" fill="#fef9c3" />
            <rect x="31" y="0" width="7" height="180" fill="#b91c1c" />
            <rect x="42" y="0" width="7" height="180" fill="#fef9c3" />
            <g fill="#713f12" stroke="#fef9c3" strokeWidth="1.2">
              <path d="M59 40 L93 58 V108 H59 Z" opacity="0.84" />
              <rect x="67" y="66" width="8" height="13" fill="#fef9c3" />
              <rect x="81" y="66" width="8" height="13" fill="#fef9c3" />
              <rect x="72" y="87" width="12" height="21" fill="#b91c1c" />
            </g>
          </>
        );
      case "fight-club":
        return (
          <>
            <g transform="rotate(-14 60 76)">
              <rect x="26" y="58" width="68" height="36" rx="7" fill="#f472b6" />
              <rect x="32" y="64" width="56" height="24" rx="4" fill="none" stroke="#be185d" strokeWidth="1.5" />
              <text
                x="60"
                y="80"
                textAnchor="middle"
                fontFamily="var(--font-mono), monospace"
                fontSize="9"
                fill="#831843"
              >
                FIGHT CLB
              </text>
            </g>
          </>
        );
      case "goodfellas":
        return (
          <>
            {/* Copacabana neon */}
            <rect x="24" y="34" width="72" height="70" rx="10" fill="none" stroke="#dc2626" strokeWidth="2.5" />
            <rect x="30" y="40" width="60" height="58" rx="7" fill="none" stroke="#fca5a5" strokeWidth="1" opacity="0.6" />
            <path d="M38 76 Q 50 58 60 72 Q 70 86 82 64" stroke="#fecaca" strokeWidth="2" fill="none" />
            <g fill="#160806">
              <circle cx="46" cy="78" r="6" />
              <path d="M38 112 Q39 83 46 83 Q53 83 54 112 Z" />
              <circle cx="61" cy="74" r="6" />
              <path d="M52 112 Q53 79 61 79 Q69 79 70 112 Z" />
              <circle cx="77" cy="80" r="6" />
              <path d="M69 112 Q70 85 77 85 Q84 85 86 112 Z" />
            </g>
          </>
        );
      case "amadeus":
        return (
          <>
            {/* Candelabra */}
            <g stroke="#fde047" strokeWidth="2" fill="none">
              <line x1="60" y1="66" x2="60" y2="104" />
              <path d="M40 76 Q 40 92 60 92" />
              <path d="M80 76 Q 80 92 60 92" />
            </g>
            <g fill="#fef08a">
              <ellipse cx="40" cy="68" rx="3" ry="6" />
              <ellipse cx="60" cy="58" rx="3" ry="6" />
              <ellipse cx="80" cy="68" rx="3" ry="6" />
            </g>
            <rect x="50" y="104" width="20" height="4" rx="2" fill="#fde047" />
          </>
        );
      case "wargames":
        return (
          <>
            {/* WOPR vector globe */}
            <g stroke="#60a5fa" strokeWidth="1.2" fill="none">
              <circle cx="60" cy="72" r="34" />
              <ellipse cx="60" cy="72" rx="34" ry="13" />
              <ellipse cx="60" cy="72" rx="13" ry="34" />
              <line x1="26" y1="72" x2="94" y2="72" />
            </g>
            <line x1="34" y1="46" x2="86" y2="98" stroke="#93c5fd" strokeWidth="1.4" />
          </>
        );
      default:
        return <circle cx="60" cy="70" r="24" fill={fg} opacity="0.7" />;
    }
  })();

  const serifTitle = id === "casablanca" || id === "goodfellas" || id === "amadeus";
  const titleColor =
    id === "royal-tenenbaums" ? "#451a03" : id === "her" ? "#fff1f2" : fg;

  return (
    <svg viewBox="0 0 120 180" className="h-full w-full" role="img" aria-label={`${film} poster`}>
      <defs>
        <linearGradient id={`${id}-poster-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bg} stopOpacity="0" />
          <stop offset="0.55" stopColor={bg} stopOpacity="0.25" />
          <stop offset="1" stopColor={bg} stopOpacity="0.98" />
        </linearGradient>
        <radialGradient id={`${id}-poster-vignette`} cx="50%" cy="42%" r="72%">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      <rect width="120" height="180" fill={bg} />
      {art}
      <rect width="120" height="180" fill={`url(#${id}-poster-vignette)`} />
      <rect y="118" width="120" height="62" fill={`url(#${id}-poster-fade)`} />
      <rect x="4.5" y="4.5" width="111" height="171" rx="1.5" fill="none" stroke="#fff" strokeWidth="0.7" opacity="0.12" />
      <line x1="28" y1="144" x2="92" y2="144" stroke={titleColor} strokeWidth="0.6" opacity="0.25" />
      <Title text={film} year={year} color={titleColor} serif={serifTitle} />
    </svg>
  );
}
