// Registry of all interactive demos. To add a demo: add an entry here, drop a
// component in components/demos/, and add a route at app/<slug>/page.tsx.
// DemoShell resolves the heading, tags, accent label, and GitHub link from
// this registry by slug, so each page only supplies its long-form copy.

/** Mini live previews available for home-page project cards. */
export type DemoPreview = "life" | "raycaster" | "cloth" | "flappy";

export type Demo = {
  slug: string; // used as the route, e.g. "mandelbrot" -> /mandelbrot
  /** Last significant page update, used by JSON-LD and the sitemap. */
  lastModified: string;
  title: string;
  titleAccent: string; // the highlighted word(s) in the page heading
  blurb: string; // short description for the playground hub
  tags: string[];
  accentLabel: string; // DemoShell appends " · Live Demo" on the demo page
  github?: string; // omitted when the source repo isn't public
  /** Present when the demo also gets a project card on the home page. */
  home?: {
    blurb: string; // card copy, longer than the hub blurb
    liveLabel: string; // the card's call-to-action label
    preview: DemoPreview; // mini live preview rendered behind the card
    tools?: string[]; // card tool chips, when they differ from `tags`
  };
};

export const demos: Demo[] = [
  {
    slug: "flappy",
    lastModified: "2026-07-20",
    title: "Neuroevolution",
    titleAccent: "Flappy Bird",
    blurb:
      "A population of neural-network birds learns Flappy Bird through neuroevolution. Play it, or watch the AI train.",
    tags: ["JavaScript", "p5.js", "Neuroevolution", "Genetic Algorithm", "Neural Networks"],
    accentLabel: "AI / ML",
    github: "https://github.com/JackB296/neuroevolution-flappy-bird",
    home: {
      blurb:
        "An AI-driven Flappy Bird where a population of neural-network birds evolves through neuroevolution, getting better over generations until it clears the pipes on its own. Play it or watch the AI learn right here.",
      liveLabel: "Play the live demo",
      preview: "flappy",
      tools: ["JavaScript", "p5.js", "Neuroevolution", "Genetic Algorithm"],
    },
  },
  {
    slug: "raycaster",
    lastModified: "2026-07-20",
    title: "Raycasting",
    titleAccent: "Engine",
    blurb:
      "A Wolfenstein-style pseudo-3D renderer. The left pane shows the 2D map and rays, the right pane shows the 3D view they build.",
    tags: ["Python", "JavaScript", "Canvas", "Raycasting", "Graphics"],
    accentLabel: "Graphics",
    github: "https://github.com/JackB296/raycasting-engine",
    home: {
      blurb:
        "A from-scratch pseudo-3D renderer that marches rays through a 2D grid, Wolfenstein-style, and draws the 2D map and its rays beside the rendered 3D view. A JS port of my Python engine, running live in your browser.",
      liveLabel: "Walk through it",
      preview: "raycaster",
      tools: ["Python", "JavaScript", "Canvas", "Raycasting"],
    },
  },
  {
    slug: "cloth",
    lastModified: "2026-07-20",
    title: "Cloth",
    titleAccent: "Simulation",
    blurb:
      "A grid of point masses linked by sticks, solved with Verlet integration. Drag across it to slice through the threads.",
    tags: ["Python", "JavaScript", "Canvas", "Verlet", "Physics", "Simulation"],
    accentLabel: "Physics",
    github: "https://github.com/JackB296/Cloth-Simulation",
    home: {
      blurb:
        "A real-time cloth of point masses linked by sticks, solved with Verlet integration. Drag your mouse across it to slice through the threads. Another JS port of my original Python simulation.",
      liveLabel: "Play with it",
      preview: "cloth",
      tools: ["Python", "JavaScript", "Canvas", "Verlet", "Physics"],
    },
  },
  {
    slug: "game-of-life",
    lastModified: "2026-07-20",
    title: "Conway's Game of",
    titleAccent: "Life",
    blurb:
      "Conway's Game of Life with age-colored cells. Click to toggle cells, then watch the patterns breathe. Born, young, and old cells are colored differently.",
    tags: ["Python", "JavaScript", "Canvas", "Cellular Automata"],
    accentLabel: "Simulation",
    github: "https://github.com/JackB296/life-sim",
    home: {
      blurb:
        "The classic cellular automaton with age-colored cells. Four tiny rules give rise to gliders, oscillators, and whole ecosystems. Draw your own cells and watch the patterns breathe. A JS port of my Python version.",
      liveLabel: "Play with it",
      preview: "life",
    },
  },
  {
    slug: "mandelbrot",
    lastModified: "2026-07-20",
    title: "Mandelbrot",
    titleAccent: "Set",
    blurb:
      "The Mandelbrot set rendered by escape-time iteration. Scroll or click to zoom into the infinite detail at the boundary.",
    tags: ["Python", "JavaScript", "Canvas", "Fractals", "Complex Numbers"],
    accentLabel: "Math",
  },
  {
    slug: "perceptron",
    lastModified: "2026-07-20",
    title: "Perceptron",
    titleAccent: "Classifier",
    blurb:
      "A single perceptron learns to separate two classes of points with a line. Step through training and watch its guess snap toward the true boundary.",
    tags: ["Python", "JavaScript", "Canvas", "Machine Learning", "Perceptron"],
    accentLabel: "AI / ML",
    github: "https://github.com/JackB296/basic-perceptron",
  },
  {
    slug: "pi-blocks",
    lastModified: "2026-07-20",
    title: "Pi from",
    titleAccent: "Collisions",
    blurb:
      "Two sliding blocks and a wall. Count their perfectly elastic collisions and the digits of pi fall out. A famous, surprising result.",
    tags: ["Python", "JavaScript", "Canvas", "Physics", "Math"],
    accentLabel: "Math",
    github: "https://github.com/JackB296/pi-blocks",
  },
];

export const getDemo = (slug: string) => demos.find((d) => d.slug === slug);
export const demoHref = (slug: string) => `/${slug}`;
