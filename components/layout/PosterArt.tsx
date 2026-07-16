import Img from "@/components/ui/Img";

// Films with a real theatrical one-sheet in /public/posters/original. The file
// path is derived from the id (below) so the id and its poster can't drift;
// House Grade — and any future grade without a scan — falls through to the
// generated cover.
const FILMS_WITH_ORIGINAL_POSTER = new Set([
  "casablanca",
  "matrix",
  "blade-runner",
  "space-odyssey",
  "dune",
  "the-batman",
  "parasite",
  "arrival",
  "fury-road",
  "her",
  "wall-e",
  "royal-tenenbaums",
  "fight-club",
  "goodfellas",
  "amadeus",
  "wargames",
]);

function HouseGradePoster({ ink, accent }: { ink: string; accent: string }) {
  const background = `rgb(${ink})`;
  const foreground = `rgb(${accent})`;

  return (
    <div
      role="img"
      aria-label="House Grade original portfolio cover"
      data-poster-texture="signal-projector-print"
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: background }}
    >
      <Img
        src="/posters/open/house-projector.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="eager"
        data-open-asset="house"
        className="absolute left-[10%] top-[18%] z-10 h-[36%] w-[48%] object-contain invert"
      />
      <svg aria-hidden="true" viewBox="0 0 120 180" className="absolute inset-0 h-full w-full">
        <path d="M52 55L125 31V118L52 78Z" fill="#34d399" opacity=".22" />
        <g>
          <rect x="72" y="58" width="15" height="15" fill="#38bdf8" />
          <rect x="89" y="75" width="15" height="15" fill="#a78bfa" />
          <rect x="72" y="92" width="15" height="15" fill="#f472b6" />
          <rect x="106" y="92" width="9" height="9" fill="#34d399" />
        </g>
        <path d="M12 151H108" stroke="#fff" strokeWidth="1" opacity=".36" />
      </svg>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[5px] border border-current opacity-20"
        style={{ color: foreground }}
      />
    </div>
  );
}

export default function PosterArt({
  id,
  film,
  ink,
  accent,
}: {
  id: string;
  film: string;
  ink: string;
  accent: string;
}) {
  const poster = FILMS_WITH_ORIGINAL_POSTER.has(id)
    ? `/posters/original/${id}.webp`
    : null;

  if (!poster) {
    return <HouseGradePoster ink={ink} accent={accent} />;
  }

  return (
    <div
      role="img"
      aria-label={`${film} original theatrical poster`}
      data-poster-texture={`original-one-sheet-${id}`}
      className="relative h-full w-full overflow-hidden bg-black"
    >
      <Img
        src={poster}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="eager"
        data-original-poster={id}
        className="absolute inset-0 h-full w-full object-contain"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
    </div>
  );
}
