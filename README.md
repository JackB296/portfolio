<div align="center">

# Jackson Bialecki

**Full-stack engineer · Web, AI/ML, and industrial systems**

The site behind [jbialecki.com](https://jbialecki.com): a WebGL hero, seven interactive demos you can play in the browser, a serverless contact backend, and write-ups of the software I've shipped on a factory floor and at an ed-tech startup.

[![Live site](https://img.shields.io/badge/live-jbialecki.com-f59e0b?style=flat-square)](https://jbialecki.com)
&nbsp;![Next.js 14](https://img.shields.io/badge/Next.js_14-111-fff?style=flat-square&logo=nextdotjs&logoColor=fff)
&nbsp;![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=fff)
&nbsp;![Three.js](https://img.shields.io/badge/Three.js-111-fff?style=flat-square&logo=threedotjs&logoColor=fff)
&nbsp;![Tailwind](https://img.shields.io/badge/Tailwind-0b1120?style=flat-square&logo=tailwindcss)

<br>

**[Open the live site →](https://jbialecki.com)**

<img src="docs/preview-hero.png" alt="The portfolio home page: a noise-displaced wireframe icosahedron rendered in WebGL, on a dark starfield" width="900">

</div>

---

## Highlights

- **A hand-written WebGL hero.** A noise-displaced icosahedron and a GPU particle field, both driven by custom GLSL vertex and fragment shaders, under a camera that eases toward the cursor. It's code-split out of the main bundle and capped to the device pixel ratio, so it stays smooth on a phone and collapses to a still frame under reduced-motion.
- **Seven interactive demos.** Six began as Python projects and were rebuilt in JavaScript and canvas: a raycaster, a Verlet cloth, Conway's Game of Life, the Mandelbrot set, a perceptron, and the pi-from-collisions trick. The Neuroevolution Flappy Bird runs as its original p5.js build, embedded live.
- **A serverless contact backend.** The form posts to `/api/contact`, which validates the payload, blocks bots with a honeypot, rate-limits by IP, and sends mail through Resend. With no API key set it stays working and shows a friendly "email me directly" message.
- **Case studies, written up as problem, approach, and outcome.** A manufacturing dashboard at Voyage Foods, a Canvas LMS integration at JAKAPA, shipping on a 50+ engineer team at LCS, a solo database migration at American Equity Funding, plus a hardware write-up of an 8-bit computer I built on breadboards.
- **Production plumbing.** Vercel CI/CD, a generated Open Graph image, a sitemap, robots rules, JSON-LD structured data, and Playwright smoke tests that load every page in CI so a bad change can't quietly break a route.

## Interactive demos

<p align="center">
  <img src="docs/preview-raycaster.png" width="49%" alt="Raycasting engine: a 2D map with rays fanning out on the left, and the pseudo-3D view they produce on the right" />
  <img src="docs/preview-mandelbrot.png" width="49%" alt="The Mandelbrot set rendered with an escape-time hot colormap" />
</p>

Each one runs live in the browser, and most link to their source on GitHub from the site.

| Demo | What it is | Play |
| --- | --- | --- |
| Neuroevolution Flappy Bird | 50 neural-network birds evolve until they clear the pipes on their own | [▶ Live](https://jbialecki.com/flappy) |
| Raycasting Engine | Wolfenstein-style pseudo-3D from 150 rays, with the 2D map and the 3D view side by side | [▶ Live](https://jbialecki.com/raycaster) |
| Cloth Simulation | Point masses on Verlet springs that you can drag across to slice | [▶ Live](https://jbialecki.com/cloth) |
| Conway's Game of Life | Age-colored cellular automaton you can draw on | [▶ Live](https://jbialecki.com/game-of-life) |
| Mandelbrot Set | Escape-time fractal with click-to-zoom and rising iteration depth | [▶ Live](https://jbialecki.com/mandelbrot) |
| Perceptron | A single perceptron learning a linear boundary, step by step | [▶ Live](https://jbialecki.com/perceptron) |
| Pi from Collisions | Colliding blocks whose collision count spells out the digits of pi | [▶ Live](https://jbialecki.com/pi-blocks) |

## Built with

- **Framework:** Next.js 14 (App Router), TypeScript, React 18
- **3D and graphics:** Three.js, React Three Fiber, drei, custom GLSL shaders, HTML canvas
- **Motion:** Framer Motion, Lenis smooth scroll
- **Styling:** Tailwind CSS, a dark theme on a single amber accent (`#f59e0b`)
- **Backend:** Resend, on a serverless Vercel route
- **Ops:** Vercel hosting and Analytics, Playwright, GitHub Actions CI

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Node 18.18 or newer (Node 20 recommended). Almost all copy lives in `lib/` (`data.ts` for the profile, experience, and projects; `caseStudies.ts`; `demos.ts`), so most content edits never touch a component.

## Tests

```bash
npm run build      # type-check, lint, and a production build
npm test           # Playwright smoke tests (run `npx playwright install chromium` once first)
```

CI runs the same lint, build, and smoke tests on every push and pull request. The smoke tests open every page, confirm the canvases mount, and check the main navigation.

<details>
<summary><b>Project structure</b></summary>

```
app/
  page.tsx               Single-page portfolio (Hero, About, Experience, Projects, Skills, Contact)
  demos/page.tsx         The playground hub that lists every interactive demo
  flappy/                The Neuroevolution Flappy Bird game, embedded live
  raycaster/ cloth/ mandelbrot/ game-of-life/ perceptron/ pi-blocks/
                         One route per demo, each built on components/demos/DemoShell
  work/[slug]/page.tsx   Case-study pages (Voyage Foods, LCS, JAKAPA, AEF, 8-bit computer)
  resume/page.tsx        The PDF résumé, embedded with print and download
  api/contact/route.ts   Serverless contact endpoint (Resend)
  opengraph-image.tsx    Generated 1200×630 social card
  sitemap.ts robots.ts   SEO surface
components/
  home/ layout/ ui/      Page sections and shared primitives
  three/                 HeroScene, DistortedSphere, ParticleField, shared GLSL noise
  demos/                 DemoShell plus one component per demo
lib/
  data.ts                Profile, experience, projects, skills (the single source of content)
  caseStudies.ts         Case-study content
  demos.ts               Registry that drives the playground
tests/
  smoke.spec.ts          Playwright smoke tests
```

</details>

---

<div align="center">

Built by Jackson Bialecki · [jbialecki.com](https://jbialecki.com) · [LinkedIn](https://www.linkedin.com/in/jackson-bialecki/)

Available for co-op, Spring 2027.

</div>
