import { test, expect } from "@playwright/test";

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
  "/work/8-bit-computer",
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

test("resume embeds the pdf", async ({ page }) => {
  await page.goto("/resume");
  await expect(page.locator('iframe[src*=".pdf"]')).toBeAttached();
  await expect(page.locator('a[download]')).toBeAttached();
});
