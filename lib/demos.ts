// Registry of all interactive demos. To add a demo: add an entry here, drop a
// component in components/demos/, and add a route at app/<slug>/page.tsx.
export type Demo = {
  slug: string; // used as the route, e.g. "mandelbrot" -> /mandelbrot
  title: string;
  titleAccent: string; // the highlighted word(s) in the page heading
  blurb: string; // short description for the playground hub
  tags: string[];
  accentLabel: string;
  github?: string; // omitted when the source repo isn't public
  origin: string; // one line on what it was ported from
};

export const demos: Demo[] = [
  {
    slug: "flappy",
    title: "Neuroevolution Flappy",
    titleAccent: "Bird",
    blurb:
      "A population of neural-network birds learns Flappy Bird through neuroevolution. Play it, or watch the AI train.",
    tags: ["p5.js", "Neuroevolution", "Genetic Algorithm"],
    accentLabel: "AI / ML",
    github: "https://github.com/JackB296/neuroevolution-flappy-bird",
    origin: "The original p5.js project, embedded live.",
  },
  {
    slug: "raycaster",
    title: "Raycasting",
    titleAccent: "Engine",
    blurb:
      "A Wolfenstein-style pseudo-3D renderer. The left pane shows the 2D map and rays, the right pane shows the 3D view they build.",
    tags: ["Python", "JavaScript", "Canvas", "Raycasting"],
    accentLabel: "Graphics",
    github: "https://github.com/JackB296/raycasting-engine",
    origin: "A faithful JS port of my Python engine.",
  },
  {
    slug: "cloth",
    title: "Cloth",
    titleAccent: "Simulation",
    blurb:
      "A grid of point masses linked by sticks, solved with Verlet integration. Drag across it to slice through the threads.",
    tags: ["Python", "JavaScript", "Canvas", "Verlet", "Physics"],
    accentLabel: "Physics",
    github: "https://github.com/JackB296/Cloth-Simulation",
    origin: "A faithful JS port of my Python cloth sim.",
  },
  {
    slug: "game-of-life",
    title: "Game of",
    titleAccent: "Life",
    blurb:
      "Conway's Game of Life with age-colored cells. Click to toggle cells, then watch the patterns breathe. Born, young, and old cells are colored differently.",
    tags: ["Python", "JavaScript", "Canvas", "Cellular Automata"],
    accentLabel: "Simulation",
    github: "https://github.com/JackB296/life-sim",
    origin: "A JS port of my Python life-sim.",
  },
  {
    slug: "mandelbrot",
    title: "Mandelbrot",
    titleAccent: "Set",
    blurb:
      "The Mandelbrot set rendered by escape-time iteration. Scroll or click to zoom into the infinite detail at the boundary.",
    tags: ["Python", "JavaScript", "Canvas", "Fractals"],
    accentLabel: "Math",
    origin: "A JS port of my Python / NumPy notebook.",
  },
  {
    slug: "perceptron",
    title: "Perceptron",
    titleAccent: "Classifier",
    blurb:
      "A single perceptron learns to separate two classes of points with a line. Step through training and watch its guess snap toward the true boundary.",
    tags: ["Python", "JavaScript", "Canvas", "Machine Learning"],
    accentLabel: "AI / ML",
    github: "https://github.com/JackB296/basic-perceptron",
    origin: "A JS port of my Python perceptron.",
  },
  {
    slug: "pi-blocks",
    title: "Pi from",
    titleAccent: "Collisions",
    blurb:
      "Two sliding blocks and a wall. Count their perfectly elastic collisions and the digits of pi fall out. A famous, surprising result.",
    tags: ["Python", "JavaScript", "Canvas", "Physics"],
    accentLabel: "Math",
    github: "https://github.com/JackB296/pi-blocks",
    origin: "A JS port of my Python pi-blocks sim.",
  },
];

export const getDemo = (slug: string) => demos.find((d) => d.slug === slug);
export const demoHref = (slug: string) => `/${slug}`;
