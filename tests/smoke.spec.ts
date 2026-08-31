import { test, expect } from "@playwright/test";
import { commitGrade, openTheater } from "./helpers";

// Every public route should load with a 200 and render a heading.
const pages = [
  "/",
  "/demos",
  "/resume",
  "/flappy",
  "/raycaster",
  "/cloth",
  "/game-of-life",
  "/mandelbrot",
  "/perceptron",
  "/pi-blocks",
  "/work/voyage-foods-dashboard",
  "/work/lcs-big-team",
  "/work/jakapa-canvas-integration",
  "/work/aef-access-migration",
  "/work/8-bit-computer",
  "/work/media-archiver",
];

for (const path of pages) {
  test(`loads ${path}`, async ({ page }) => {
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res?.status(), `status for ${path}`).toBeLessThan(400);
    await expect(page.locator("h1").first()).toBeVisible();
  });
}

// Canvas-based demos must actually mount a canvas.
const canvasDemos = ["/raycaster", "/cloth", "/game-of-life", "/mandelbrot", "/perceptron", "/pi-blocks"];
for (const path of canvasDemos) {
  test(`canvas mounts on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("canvas").first()).toBeVisible();
  });
}

test("flappy embeds its game iframe", async ({ page }) => {
  await page.goto("/flappy");
  await expect(page.locator('iframe[src="/neat-flappy/index.html"]')).toBeAttached();
});

test("home nav links to sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('header a[href="#projects"]').first()).toBeVisible();
  await expect(page.locator("#projects")).toBeAttached();
  await expect(page.locator("#experience")).toBeAttached();
  await expect(page.locator("#contact")).toBeAttached();
});

test("project cards link into work and demos", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('#projects a[href="/work/8-bit-computer"]').first()).toBeAttached();
  await expect(page.locator('#projects a[href="/flappy"]').first()).toBeAttached();
});

test("theater selection regrades and persists the site", async ({ page }) => {
  await page.goto("/");
  await page.setViewportSize({ width: 1280, height: 800 });
  await openTheater(page);
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  // 17 posters: house grade + 16 films
  await expect(dialog.locator("button[aria-pressed]")).toHaveCount(17);
  await dialog.locator('button[title="The Matrix (1999)"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-grade", "matrix");
  // Persisted for the next visit
  const stored = await page.evaluate(() => localStorage.getItem("film-grade"));
  expect(stored).toBe("matrix");
  await expect(dialog).not.toBeAttached();
});

test("theater lifecycle preserves the page and restores focus", async ({ page }) => {
  await page.goto("/");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 720);
  });

  const trigger = page.locator('button[aria-haspopup="dialog"]').first();
  const initialScroll = await page.evaluate(() => window.scrollY);
  const dialog = await openTheater(page);
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.width ?? 1440).toBeLessThanOrEqual(1280 * 0.88);
  expect(dialogBox?.height ?? 800).toBeLessThanOrEqual(800 * 0.84);
  expect(dialogBox?.x ?? 0).toBeGreaterThan(0);
  expect(dialogBox?.y ?? 0).toBeGreaterThan(0);

  const close = page.getByRole("button", { name: "Close theater" });
  await expect(close).toBeFocused();
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initialScroll);

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeAttached();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(initialScroll);

  await openTheater(page);
  await expect(dialog).toBeVisible();
  await page.locator("[data-theater-backdrop]").click({ position: { x: 4, y: 4 } });
  await expect(dialog).not.toBeAttached();
});

test("theater keeps the compact catalog contained without moving the page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 640);
  });

  const initialPageScroll = await page.evaluate(() => window.scrollY);
  const dialog = await openTheater(page);
  const catalog = dialog.locator("[data-theater-catalog]");
  await expect(catalog).toBeVisible();
  await expect(catalog.locator("[data-film-scene]")).toHaveCount(17);
  await catalog.hover({ position: { x: 80, y: 240 } });
  await page.mouse.wheel(0, 560);

  expect(await page.evaluate(() => window.scrollY)).toBe(initialPageScroll);
});

test("theater reel previews without persistence and selects explicitly", async ({ page }) => {
  await page.goto("/");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => localStorage.removeItem("film-grade"));

  const dialog = await openTheater(page);
  const scenes = dialog.locator("[data-film-scene]");
  await expect(scenes).toHaveCount(17);

  const matrix = dialog.locator('[data-film-scene="matrix"]');
  await matrix.getByRole("button", { name: "Use The Matrix grade" }).focus();
  await expect(page.locator("html")).toHaveAttribute("data-grade", "matrix");
  expect(await page.evaluate(() => localStorage.getItem("film-grade"))).toBeNull();

  await page.getByRole("button", { name: "Close theater" }).click();
  await expect(dialog).not.toBeAttached();
  await expect(page.locator("html")).not.toHaveAttribute("data-grade");

  const reopenedDialog = await openTheater(page);
  await commitGrade(page, "matrix");

  await expect(reopenedDialog).not.toBeAttached();
  await expect(page.locator("html")).toHaveAttribute("data-grade", "matrix");
  expect(await page.evaluate(() => localStorage.getItem("film-grade"))).toBe("matrix");
});

test("theater stays above the mobile navigation", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator('button[aria-haspopup="dialog"]:visible').click();
  await expect(page.getByRole("dialog", { name: "Film theater" })).toBeVisible();

  // Poll rather than read once: the dialog animates in, so under load the
  // corner may not be covered on the first frame after it reports visible.
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .elementFromPoint(24, 24)
          ?.closest('[role="dialog"]')
          ?.getAttribute("aria-label")
      )
    )
    .toBe("Film theater");
});

test("theater honors reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator('button[aria-haspopup="dialog"]:visible').click();

  const dialog = page.getByRole("dialog", { name: "Film theater" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-theater-catalog]")).toHaveCSS(
    "scroll-behavior",
    "auto"
  );
});

test("Game of Life grade palette follows theater previews", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("film-grade"));

  // Life is the house default; pick it explicitly so the choice sticks through
  // the theater previews below, and read its pixels.
  await page.locator('button[title="Game of Life"]').click();
  const canvas = page.locator("#top canvas");
  await expect(canvas).toBeVisible();
  const dialog = await openTheater(page);
  await dialog.locator('[data-film-scene="casablanca"] button').focus();
  await expect(page.locator("html")).toHaveAttribute("data-grade", "casablanca");

  const casablancaPixels = await canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context) return { living: 0, chromatic: 0 };
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    let living = 0;
    let chromatic = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] === 0) continue;
      living += 1;
      if (
        Math.abs(pixels[index] - pixels[index + 1]) > 2 ||
        Math.abs(pixels[index + 1] - pixels[index + 2]) > 2
      ) {
        chromatic += 1;
      }
    }
    return { living, chromatic };
  });
  expect(casablancaPixels.living).toBeGreaterThan(0);
  expect(casablancaPixels.chromatic).toBe(0);

  await dialog.locator('[data-film-scene="dune"] button').focus();
  await expect(page.locator("html")).toHaveAttribute("data-grade", "dune");
  const duneWarmPixels = await canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    let warm = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (
        pixels[index + 3] > 0 &&
        pixels[index] > pixels[index + 1] &&
        pixels[index + 1] > pixels[index + 2]
      ) {
        warm += 1;
      }
    }
    return warm;
  });
  expect(duneWarmPixels).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Close theater" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-grade");
  await expect
    .poll(() =>
      canvas.evaluate((element: HTMLCanvasElement) => {
        const context = element.getContext("2d");
        if (!context) return false;
        const pixels = context.getImageData(0, 0, element.width, element.height).data;
        for (let index = 0; index < pixels.length; index += 4) {
          if (
            pixels[index + 3] > 0 &&
            (Math.abs(pixels[index] - pixels[index + 1]) > 8 ||
              Math.abs(pixels[index + 1] - pixels[index + 2]) > 8)
          ) {
            return true;
          }
        }
        return false;
      })
    )
    .toBe(true);
});

test("theater trigger carries the Now Showing label and dialog stays inset", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  // Since the uniqueness-suite redesign (July 2026) the trigger is a compact
  // marquee pill: icon plus the active grade's name.
  const trigger = page.locator('header button[aria-haspopup="dialog"]').first();
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("title", "Film theater");
  await expect(trigger).toContainText("Theater");
  const triggerBox = await trigger.boundingBox();
  expect(triggerBox?.width ?? 0).toBeLessThanOrEqual(140);
  expect(triggerBox?.height ?? 0).toBeLessThanOrEqual(40);

  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Film theater" });
  const desktopBox = await dialog.boundingBox();
  expect(desktopBox?.width ?? 1440).toBeLessThanOrEqual(1440 * 0.88);
  expect(desktopBox?.height ?? 900).toBeLessThanOrEqual(900 * 0.84);
  expect(desktopBox?.x ?? 0).toBeGreaterThan(0);
  expect(desktopBox?.y ?? 0).toBeGreaterThan(0);

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 768, height: 1024 });
  await trigger.click();
  const tabletBox = await dialog.boundingBox();
  expect(tabletBox?.width ?? 768).toBeLessThanOrEqual(768 * 0.92);
  expect(tabletBox?.height ?? 1024).toBeLessThanOrEqual(1024 * 0.88);
  expect(tabletBox?.x ?? 0).toBeGreaterThan(24);
  expect(tabletBox?.y ?? 0).toBeGreaterThan(24);

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator('button[aria-haspopup="dialog"]:visible').click();
  const mobileBox = await dialog.boundingBox();
  expect(mobileBox?.width ?? 375).toBeLessThanOrEqual(359);
  expect(mobileBox?.height ?? 667).toBeLessThanOrEqual(651);
  expect(mobileBox?.x ?? 0).toBeGreaterThanOrEqual(7);
  expect(mobileBox?.y ?? 0).toBeGreaterThanOrEqual(7);
});

test("open hero removes terminal framing and softens the Game of Life", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const intro = page.getByTestId("hero-intro");
  await expect(intro).toBeVisible();
  await expect(intro.locator("h1")).toBeVisible();
  await expect(intro.getByRole("link", { name: /view projects/i })).toBeVisible();
  await expect(page.getByTestId("hero-terminal-frame")).toHaveCount(0);
  await expect(page.getByText("jackson@portfolio: ~", { exact: true })).toHaveCount(0);
  await expect(page.getByText("neofetch", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "JB ASCII logo" })).toHaveCount(0);
  await expect(page.getByTestId("hero-terminal")).toHaveCount(0);
  // The blur softening applies to the Game of Life backdrop, not the orbit.
  await page.locator('button[title="Game of Life"]').click();
  await expect(page.locator("#top canvas")).toHaveCSS("filter", "blur(3px)");

  await page.setViewportSize({ width: 375, height: 667 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ).toBe(false);
});

test("hero backdrop defaults to life under the house and switches to orbit", async ({ page }) => {
  await page.goto("/");
  const wrap = page.locator("[data-hero-bg]");
  // The house has no film behind it, so it gets the automaton by default.
  await expect(wrap).toHaveAttribute("data-hero-bg", "life");
  await page.locator('button[title="3D orbit"]').click();
  await expect(wrap).toHaveAttribute("data-hero-bg", "orbit");
  // The three.js scene actually mounts a canvas. Headless WebGL init can
  // stall well past 10s when workers share the machine; give it room.
  await expect(wrap.locator("canvas")).toBeVisible({ timeout: 20_000 });
  // Choice persists across a reload
  await page.reload();
  await expect(page.locator("[data-hero-bg]")).toHaveAttribute("data-hero-bg", "orbit");
});

test("3D orbit follows theater previews and restores the grade palette", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  // The house defaults to Life now, so pick orbit explicitly to mount its
  // scene; the choice sticks through the previews below.
  await page.locator('button[title="3D orbit"]').click();
  const orbit = page.getByTestId("orbit-theme");
  const canvas = orbit.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  const initialCanvas = await canvas.elementHandle();
  if (!initialCanvas) throw new Error("Orbit canvas did not mount");

  const currentCssPalette = () =>
    page.locator("html").evaluate((element) => {
      const styles = getComputedStyle(element);
      const color = (name: string) =>
        `rgb(${styles.getPropertyValue(name).trim().split(/\s+/).join(", ")})`;
      return {
        accent: color("--accent-rgb"),
        bright: color("--accent-bright-rgb"),
        dim: color("--accent-dim-rgb"),
        inkSoft: color("--ink-soft-rgb"),
      };
    });
  const renderedOrbitPalette = () =>
    orbit.evaluate((element) => ({
      accent: element.getAttribute("data-orbit-accent"),
      bright: element.getAttribute("data-orbit-bright"),
      dim: element.getAttribute("data-orbit-dim"),
      inkSoft: element.getAttribute("data-orbit-ink-soft"),
    }));

  const housePalette = await currentCssPalette();
  await expect.poll(renderedOrbitPalette).toEqual(housePalette);

  const dialog = await openTheater(page);
  await dialog.locator('[data-film-scene="dune"] button').focus();
  await expect(page.locator("html")).toHaveAttribute("data-grade", "dune");
  const dunePalette = await currentCssPalette();
  expect(dunePalette).not.toEqual(housePalette);
  await expect.poll(renderedOrbitPalette).toEqual(dunePalette);

  await dialog.locator('[data-film-scene="casablanca"] button').focus();
  await expect(page.locator("html")).toHaveAttribute("data-grade", "casablanca");
  await expect.poll(renderedOrbitPalette).toEqual(await currentCssPalette());

  await page.getByRole("button", { name: "Close theater" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-grade");
  await expect.poll(renderedOrbitPalette).toEqual(housePalette);
  expect(await canvas.evaluate((current, initial) => current === initial, initialCanvas)).toBe(true);
});

test("resume embeds the pdf", async ({ page }) => {
  await page.goto("/resume");
  await expect(page.locator('iframe[src*=".pdf"]')).toBeAttached();
  await expect(page.locator('a[download]')).toBeAttached();
});
