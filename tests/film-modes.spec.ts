import { expect, test } from "@playwright/test";
import { grades } from "../lib/grades";
import { filmExperiences } from "../lib/films";
import { planePosition } from "../components/film-experience/modes/casablanca";
import {
  commitGrade,
  dispatchGrade,
  openTheater,
  visiblePixelCount,
} from "./helpers";

test("film experience registry contract covers every named grade", () => {
  const gradeIds = grades.map((grade) => grade.id).sort();
  const experienceIds = filmExperiences.map((experience) => experience.id).sort();

  expect(experienceIds).toEqual(gradeIds);
  expect(new Set(experienceIds).size).toBe(16);

  for (const experience of filmExperiences) {
    expect(experience.signature.length).toBeGreaterThan(8);
    expect(experience.markers.length).toBeGreaterThanOrEqual(5);
    // A music bed is optional — Dune runs on its sand loop and Fury Road on its
    // dust loop alone — but when a film has one it must be a music cue.
    if (experience.audio.music) expect(experience.audio.music.mode).toBe("music");
    expect(experience.audio.music || experience.audio.effects.length > 0).toBeTruthy();
    for (const cue of [
      ...(experience.audio.music ? [experience.audio.music] : []),
      ...experience.audio.effects,
    ]) {
      expect(cue.label.length).toBeGreaterThan(3);
      expect(cue.src).toMatch(/^\/audio\/film-modes\/[a-z0-9-]+\.mp3$/);
      expect(cue.volume).toBeGreaterThan(0);
      expect(cue.volume).toBeLessThanOrEqual(1);
      expect(cue.filterFrequency).toBeGreaterThan(0);
      expect(cue.scrollResponse).toBeGreaterThanOrEqual(0);
      expect(cue.scrollResponse).toBeLessThanOrEqual(1);
      expect(cue.mode).toMatch(/^(loop|event|music)$/);
    }
    expect(experience.visualAssets.every((asset) => asset.src.startsWith("/posters/open/"))).toBe(true);
    expect(experience.tokens.motion).toMatch(/^(dissolve|drift|precision|pulse|stalk|descend|loop|rush|breathe|pantomime|snap|rupture|track|theatrical|terminal)$/);
    expect(typeof experience.loadVisuals).toBe("function");
  }
  // Every film that has a music bed brings its own recording. Dune and Fury
  // Road have no bed at all, so 14 beds across 16 films.
  const musicSources = filmExperiences.flatMap(({ audio }) =>
    audio.music ? [audio.music.src] : []
  );
  expect(new Set(musicSources).size).toBe(14);
  expect(
    filmExperiences
      .filter(({ audio }) => !audio.music)
      .map(({ id }) => id)
      .sort()
  ).toEqual(["dune", "fury-road"]);
  // After the 2026-07-16 motif overhaul, only these films keep DOM image
  // layers; the rest are fully authored canvas worlds. (2001's Jupiter plate
  // was retired along with its old aperture glow.)
  expect(
    filmExperiences
      .filter(({ visualAssets }) => visualAssets.length > 0)
      .map(({ id }) => id)
      .sort()
  ).toEqual(["arrival", "dune"]);

  const effectFilms = filmExperiences
    .filter(({ audio }) => audio.effects.length > 0)
    .map(({ id }) => id)
    .sort();
  expect(effectFilms).toEqual([
    "blade-runner",
    "casablanca",
    "dune",
    "fury-road",
    "goodfellas",
    "matrix",
    "wargames",
  ]);
  expect(filmExperiences.find(({ id }) => id === "matrix")?.audio.effects[0].label).toMatch(/data|number/i);
  expect(filmExperiences.find(({ id }) => id === "wargames")?.audio.effects[0].label).toMatch(/whisper/i);

  // 2001 is scroll-inert by owner's decision (2026-07-21): no scroll-driven
  // gain, rate, or event cue. Its whispered HAL line was removed with the
  // scroll behaviour, since event cues only ever re-fire from scroll velocity.
  const odyssey = filmExperiences.find(({ id }) => id === "space-odyssey");
  expect(odyssey?.audio.effects).toEqual([]);
  // 2001 keeps its bed, so assert it exists before reading through it — `music`
  // is optional now that Dune and Fury Road run without one.
  expect(odyssey?.audio.music).toBeDefined();
  expect(odyssey?.audio.music?.scrollResponse).toBe(0);
  expect(odyssey?.audio.music?.scrollGain).toBe(0);
  expect(odyssey?.audio.music?.scrollRate).toBe(0);
  // The bed skips the recording's slow opening, on the first pass and on loop.
  expect(odyssey?.audio.music?.startAt).toBe(3);

  // Fury Road runs on dust alone (2026-07-21): the music bed and the engine
  // loop were both retired, and the single remaining loop reuses Dune's CC0
  // sand recording, filtered darker and driven harder. Its scroll response
  // stays inside the same revved-down band the engine held from 2026-07-16.
  const fury = filmExperiences.find((experience) => experience.id === "fury-road");
  expect(fury?.audio.music).toBeUndefined();
  expect(fury?.audio.effects).toHaveLength(1);
  expect(fury?.audio.effects[0].src).toBe("/audio/film-modes/dune-sand.mp3");
  expect(fury?.audio.effects[0].label).toMatch(/dust/i);
  expect(fury?.audio.effects[0].mode).toBe("loop");
  const furyScrollResponse = fury?.audio.effects[0].scrollResponse;
  expect(furyScrollResponse).toBeGreaterThanOrEqual(0.3);
  expect(furyScrollResponse).toBeLessThanOrEqual(0.6);
});

test("every film music and effect cue is a decodable local recording", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const cues = filmExperiences.flatMap(({ id, audio }) => [
    ...(audio.music ? [{ id, role: "music", src: audio.music.src }] : []),
    ...audio.effects.map(({ src }) => ({ id, role: "effect", src })),
  ]);
  const decoded = await page.evaluate(async (sources) => {
    const context = new OfflineAudioContext(2, 1, 44100);
    return Promise.all(
      sources.map(async ({ id, role, src }) => {
        const response = await fetch(src);
        const data = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(data);
        return {
          id,
          role,
          src,
          ok: response.ok,
          contentType: response.headers.get("content-type"),
          duration: buffer.duration,
          channels: buffer.numberOfChannels,
        };
      })
    );
  }, cues);

  // 14 music beds + 7 effect cues (2001's HAL whisper retired 2026-07-21;
  // Dune's choir retired the same day, leaving it on sand alone; Fury Road's
  // bed and engine retired the same day, leaving it on a dust loop that reuses
  // Dune's sand recording — so dune-sand.mp3 is fetched twice here, once per
  // film that cues it; Fight Club's impact hit retired the same day, leaving it
  // on its breakbeat bed alone).
  expect(decoded).toHaveLength(21);
  for (const recording of decoded) {
    expect(recording.ok, recording.src).toBe(true);
    expect(recording.contentType, recording.src).toContain("audio/mpeg");
    expect(recording.duration, recording.src).toBeGreaterThan(1);
    expect(recording.channels, recording.src).toBeGreaterThanOrEqual(1);
  }
  expect(decoded.find(({ id, role }) => id === "amadeus" && role === "music")?.duration).toBeGreaterThan(40);
});

test("theater cover wall searches, previews, and exposes distinct materials", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const dialog = await openTheater(page);
  const search = dialog.getByRole("searchbox", { name: "Search films" });
  const catalog = dialog.locator("[data-theater-catalog]");
  const originalPosters = catalog.locator("img[data-original-poster]");
  await expect(search).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Media credits" })).toHaveAttribute(
    "href",
    "/film-credits"
  );
  await expect(catalog.locator("[data-film-scene]")).toHaveCount(17);
  await expect(originalPosters).toHaveCount(16);
  expect(
    await originalPosters.evaluateAll((images) =>
      images.every((image) => image.getAttribute("src")?.startsWith("/posters/original/"))
    )
  ).toBe(true);
  await expect
    .poll(() =>
      originalPosters.evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0
        )
      )
    )
    .toBe(true);
  await expect
    .poll(() => catalog.evaluate((element) => element.scrollHeight <= element.clientHeight + 1))
    .toBe(true);

  const textures = await catalog
    .locator("[data-poster-texture]")
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-poster-texture")));
  expect(new Set(textures).size).toBe(17);

  for (const { id } of grades) {
    await expect(
      catalog.locator(`[data-film-scene="${id}"] img[data-original-poster="${id}"]`)
    ).toHaveAttribute("src", `/posters/original/${id}.webp`);
  }
  await expect(
    catalog.locator('[data-film-scene="house"] img[data-open-asset="house"]')
  ).toHaveAttribute("src", "/posters/open/house-projector.svg");

  await search.fill("sand");
  await expect(catalog.locator("[data-film-scene]")).toHaveCount(1);
  const dune = catalog.locator('[data-film-scene="dune"]');
  await dune.getByRole("button", { name: "Use Dune grade" }).focus();
  await expect(page.locator("html")).toHaveAttribute("data-grade", "dune");
  await expect(dialog.locator("[data-theater-detail]")).toContainText("Dune");
  await expect(dialog.locator("[data-theater-detail]")).toContainText(
    "All hail Villeneuve"
  );
  await expect(dialog.locator("[data-theater-detail]")).toContainText("Reviewed by");

  await search.fill("no matching film");
  await expect(dialog.getByText("No films match that search.")).toBeVisible();
});

test("film media credits publish the required attribution and edit notices", async ({
  page,
}) => {
  await page.goto("/film-credits");
  await expect(page.getByRole("heading", { name: "Media credits" })).toBeVisible();
  await expect(page.getByText("Kevin MacLeod")).toBeVisible();
  await expect(page.getByRole("link", { name: "CC BY 3.0" })).toHaveAttribute(
    "href",
    "https://creativecommons.org/licenses/by/3.0/"
  );
  await expect(page.getByText(/copyright-free recording was supplied for/)).toBeVisible();
  // The Jupiter plate (the only CC BY visual) was retired on 2026-07-16 with
  // 2001's motif overhaul; background plates are CC0/PD and need no credit.
  await expect(page.getByText(/CC0, public-domain, or U.S. government works/)).toBeVisible();
});

test("theater emits preview, commit, and restore intent", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    (window as typeof window & { __gradeIntents?: string[] }).__gradeIntents = [];
    window.addEventListener("gradechange", (event) => {
      const detail = (event as CustomEvent<{ intent?: string }>).detail;
      (window as typeof window & { __gradeIntents?: string[] }).__gradeIntents?.push(
        detail?.intent ?? "missing"
      );
    });
  });

  const dialog = await openTheater(page);
  const dune = dialog.locator('[data-film-scene="dune"]');
  await dune.getByRole("button", { name: "Use Dune grade" }).focus();
  await expect(page.locator("html")).toHaveAttribute("data-grade", "dune");
  await dune.getByRole("button", { name: "Use Dune grade" }).click();

  await openTheater(page);
  await dialog
    .locator('[data-film-scene="matrix"]')
    .getByRole("button", { name: "Use The Matrix grade" })
    .focus();
  await page.getByRole("button", { name: "Close theater" }).click();

  const intents = await page.evaluate(
    () => (window as typeof window & { __gradeIntents?: string[] }).__gradeIntents
  );
  expect(intents).toContain("preview");
  expect(intents).toContain("commit");
  expect(intents?.at(-1)).toBe("restore");
});

test("global film lifecycle keeps compact controls across routes and House tears down", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("group", { name: "Cinematic mode controls" })).toHaveCount(0);

  await openTheater(page);
  await commitGrade(page, "dune");

  await expect(page.locator("html")).toHaveAttribute("data-film-mode", "dune");
  const controls = page.getByRole("group", { name: "Cinematic mode controls" });
  await expect(controls).toBeVisible();
  await expect(controls.getByText("Dune")).toBeAttached();
  // Committing a film is a user gesture, so sound defaults on.
  await expect(controls.getByRole("button", { name: "sound on" })).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 15_000 }
  );
  await expect(controls.getByRole("button", { name: /effects/ })).toHaveCount(0);

  await page.goto("/resume");
  await expect(page.locator("html")).toHaveAttribute("data-film-mode", "dune");
  await expect(page.getByRole("group", { name: "Cinematic mode controls" })).toBeVisible();

  await page.goto("/");
  await openTheater(page);
  await commitGrade(page, "house");
  await expect(page.locator("html")).not.toHaveAttribute("data-film-mode");
  await expect(page.getByRole("group", { name: "Cinematic mode controls" })).toHaveCount(0);
});

test("audio defaults on at commit, follows commits instead of previews, and mutes cleanly", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await openTheater(page);
  await commitGrade(page, "dune");

  const root = page.locator("[data-film-experience-root]");
  await expect(root).toHaveAttribute("data-audio-state", "running", { timeout: 20_000 });
  await expect(root).toHaveAttribute("data-audio-film", "dune");
  // Dune has no music bed: the sand loop alone must still arm the pipeline.
  await expect(root).toHaveAttribute("data-audio-music-source", "none");
  await expect(root).toHaveAttribute("data-audio-effect-sources", "/audio/film-modes/dune-sand.mp3");
  await expect(page.getByRole("button", { name: "sound on" })).toHaveAttribute(
    "title",
    /Flowing desert sand/
  );
  await expect.poll(() => root.getAttribute("data-audio-nodes")).not.toBe("0");

  const dialog = await openTheater(page);
  const matrix = dialog.locator('[data-film-scene="matrix"]');
  await matrix.getByRole("button", { name: "Use The Matrix grade" }).focus();
  await expect(page.locator("html")).toHaveAttribute("data-film-mode", "matrix");
  await expect(root).toHaveAttribute("data-audio-film", "dune");

  await matrix.getByRole("button", { name: "Use The Matrix grade" }).click();
  await expect(root).toHaveAttribute("data-audio-film", "matrix");

  const nextCues = {
    arrival: "/audio/film-modes/arrival-music.mp3",
    wargames: "/audio/film-modes/wargames-music.mp3",
    amadeus: "/audio/film-modes/amadeus-music.mp3",
    // Fury Road lost its bed with the engine on 2026-07-21: dust alone.
    "fury-road": "none",
  } as const;
  for (const [gradeId, source] of Object.entries(nextCues)) {
    await dispatchGrade(page, gradeId, "commit");
    await expect(root).toHaveAttribute("data-audio-film", gradeId);
    await expect(root).toHaveAttribute(
      "data-audio-music-source",
      source
    );
  }
  // Fury Road runs on a lone dust loop now, and it still responds to scroll
  // gently — the same bounded rate band the retired engine held from
  // 2026-07-16, so dust at speed never swells on a single gesture.
  await expect(root).toHaveAttribute(
    "data-audio-effect-sources",
    "/audio/film-modes/dune-sand.mp3"
  );
  const furyDust = filmExperiences.find(({ id }) => id === "fury-road")?.audio.effects[0];
  expect(furyDust?.scrollRate).toBeGreaterThan(0.05);
  expect(furyDust?.scrollRate).toBeLessThanOrEqual(0.15);
  expect(Number(await root.getAttribute("data-audio-tracks"))).toBeLessThanOrEqual(4);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(root).toHaveAttribute("data-audio-state", "suspended");
  await page.waitForTimeout(850);
  await expect(root).toHaveAttribute("data-audio-state", "suspended");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(root).toHaveAttribute("data-audio-state", "running");

  await page.getByRole("button", { name: "sound on" }).click();
  await expect(root).toHaveAttribute("data-audio-state", "off");
  await expect(root).toHaveAttribute("data-audio-music-source", "none");
  await expect(root).toHaveAttribute("data-audio-nodes", "0");
  await expect(root).toHaveAttribute("data-audio-tracks", "0");

  // Committing another film re-arms the sound-on default.
  await dispatchGrade(page, "arrival", "commit");
  await expect(root).toHaveAttribute("data-audio-state", "running", { timeout: 20_000 });
  await expect(root).toHaveAttribute("data-audio-film", "arrival");
});

test("canvas runtime owns one renderer and House removes it", async ({ page }) => {
  await page.goto("/");
  await openTheater(page);
  await commitGrade(page, "dune");

  const root = page.locator("[data-film-experience-root]");
  const canvas = page.locator("canvas[data-cinematic-layer]");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();
  await expect(root).toHaveAttribute("data-visual-film", "dune");
  await expect(root).toHaveAttribute("data-frame-state", "running");
  await expect(canvas).toHaveCSS("pointer-events", "none");

  await openTheater(page);
  await commitGrade(page, "house");
  await expect(page.locator("canvas[data-cinematic-layer]")).toHaveCount(0);
  await expect(root).toHaveAttribute("data-frame-state", "off");
});

test("reduced motion renders a deliberate static film frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await openTheater(page);
  await commitGrade(page, "casablanca");

  const root = page.locator("[data-film-experience-root]");
  await expect(root).toHaveAttribute("data-frame-state", "static");
  await expect(page.locator("canvas[data-cinematic-layer]")).toHaveAttribute(
    "data-static-frame",
    "true"
  );

  await page.setViewportSize({ width: 720, height: 840 });
  await expect
    .poll(() => visiblePixelCount(page.locator("canvas[data-cinematic-layer]")))
    .toBeGreaterThan(20);
});

test("Casablanca plane weaves left-to-right across the frame, not a diagonal landing", () => {
  const width = 1200;
  const height = 800;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let rawTime = 0; rawTime <= 60; rawTime += 0.25) {
    const { x, y } = planePosition(rawTime, width, height);
    xs.push(x);
    ys.push(y);
  }

  // Left-to-right crossing: the aircraft enters past the left edge and exits
  // past the right, sweeping the full width.
  expect(Math.min(...xs)).toBeLessThan(0);
  expect(Math.max(...xs)).toBeGreaterThan(width);

  // Weaving flight stays in the upper band the whole time — it is deliberately
  // NOT the earlier spec's diagonal descent that would end in the lower-right.
  expect(Math.min(...ys)).toBeGreaterThan(height * 0.05);
  expect(Math.max(...ys)).toBeLessThan(height * 0.4);
});

test("Casablanca serves its aircraft silhouette and renders an authored world", async ({ page }) => {
  await page.goto("/");
  const plane = await page.request.get("/posters/open/casablanca-plane.webp");
  expect(plane.ok()).toBe(true);
  expect(plane.headers()["content-type"]).toContain("image/webp");

  await openTheater(page);
  await commitGrade(page, "casablanca");

  const canvas = page.locator("canvas[data-cinematic-layer]");
  await expect(canvas).toHaveAttribute("data-renderer", "casablanca");
  // The aircraft is drawn by the canvas runtime; no DOM image layer remains.
  await expect(page.locator("img[data-film-asset]")).toHaveCount(0);
});

test("film modes load their verified real-asset fragments", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-film-experience-root]")).toHaveAttribute(
    "data-experience-ready",
    "true"
  );

  for (const experience of filmExperiences) {
    await dispatchGrade(page, experience.id, "commit");

    const assets = page.locator(`[data-film-asset][data-film-id="${experience.id}"]`);
    await expect(assets).toHaveCount(experience.visualAssets.length);
    if (experience.id === "matrix") continue;
    await expect
      .poll(() =>
        assets.evaluateAll((images) =>
          images.every((image) => {
            const element = image as HTMLImageElement;
            return element.complete && element.naturalWidth > 0;
          })
        )
      )
      .toBe(true);
  }
});

test("WarGames exposes a keyboard-operable draw simulation", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("film-grade", "wargames"));
  await page.goto("/");

  // WarGames has two games behind a launcher — the pill opens the menu, and
  // tic-tac-toe is one item on it. The shell fronts every game with its
  // reference card, so the board only appears once the visitor starts.
  const openButton = page.getByRole("button", { name: "Shall we play a game?" });
  await openButton.click();
  const menu = page.getByRole("dialog", { name: "Shall we play a game?" });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "tic-tac-toe simulation" }).click();
  const dialog = page.getByRole("dialog", { name: "JXN-83 tic-tac-toe simulation" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Draw-seeking simulation")).toBeVisible();
  const startButton = dialog.getByRole("button", { name: "Play a game" });
  await expect(startButton).toBeFocused();
  await startButton.click();

  const closeButton = dialog.getByRole("button", { name: "Close simulation" });
  const resetButton = dialog.getByRole("button", { name: "Reset simulation" });
  await expect(resetButton).toBeVisible();

  // The board is fully keyboard-operable: focus a cell, press it, and WOPR
  // answers — two marks on the board without a pointer in sight.
  const firstCell = dialog.getByRole("button", { name: "Cell 1 empty" });
  await firstCell.focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("button", { name: "Cell 1 X" })).toBeVisible();
  await expect(dialog.locator("[data-sim-state]"))
    .toHaveAttribute("data-simulation-moves", "2");

  await resetButton.click();
  await expect(dialog.locator("[data-sim-state]"))
    .toHaveAttribute("data-simulation-moves", "0");
  await closeButton.focus();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(openButton).toBeFocused();
});

test("WarGames launcher runs the thermonuclear game", async ({ page }) => {
  // Launcher-level only: the menu opens each game behind its reference card
  // and escape hands focus back. Deep gameplay lives in tests/sim-wargames.spec.ts.
  await page.addInitScript(() => localStorage.setItem("film-grade", "wargames"));
  await page.goto("/");

  const pill = page.getByRole("button", { name: "Shall we play a game?" });
  const menu = page.getByRole("dialog", { name: "Shall we play a game?" });

  const games: Array<[entry: string, title: string, start: string]> = [
    ["global thermonuclear war", "Global thermonuclear war", "Begin simulation"],
  ];
  for (const [entry, title, start] of games) {
    await pill.click();
    await menu.getByRole("button", { name: entry }).click();
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: start })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(pill).toBeFocused();
  }

  // Declining is reachable in one step from the strategic game's first screen.
  await pill.click();
  await menu.getByRole("button", { name: "global thermonuclear war" }).click();
  const war = page.getByRole("dialog", { name: "Global thermonuclear war" });
  await war.getByRole("button", { name: "Begin simulation" }).click();
  await war.getByRole("button", { name: "Decline to play" }).click();
  await expect(war.locator("[data-sim-state]")).toHaveAttribute("data-sim-state", "refused");
  await page.keyboard.press("Escape");
  await expect(war).toHaveCount(0);
  await expect(pill).toBeFocused();
});

test("Matrix launcher runs decode, bullet-time, and the pill choice", async ({ page }) => {
  // Launcher-level only: the menu opens each trial and escape returns focus.
  // Deep gameplay coverage lives in tests/sim-matrix.spec.ts.
  await page.addInitScript(() => localStorage.setItem("film-grade", "matrix"));
  await page.goto("/");

  const pill = page.getByRole("button", { name: "Free your mind" });
  const menu = page.getByRole("dialog", { name: "Free your mind" });

  const games: Array<[entry: string, title: string, start: string]> = [
    ["decode the rain", "Decode the rain", "Run the trace"],
    ["bullet-time", "Bullet-time", "Enter the loop"],
    ["red pill or blue", "Red pill or blue", "Take the offer"],
  ];
  for (const [entry, title, start] of games) {
    await pill.click();
    await menu.getByRole("button", { name: entry }).click();
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    // The reference card fronts every game: the start control holds focus.
    await expect(dialog.getByRole("button", { name: start })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(pill).toBeFocused();
  }
});

test("audio failure tears down only the failed film", async ({ page }) => {
  test.setTimeout(60_000);
  // Dune's recordings never arrive; its sound pipeline must fail closed
  // instead of leaving the control stuck on.
  await page.route("**/audio/film-modes/dune-*", (route) => route.abort());
  await page.goto("/");

  await openTheater(page);
  await commitGrade(page, "dune");

  const root = page.locator("[data-film-experience-root]");
  await expect(root).toHaveAttribute("data-audio-state", "off", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "sound off" })).toBeVisible();

  // The failure must not poison the shared audio pipeline: an unblocked film
  // committed afterwards still gets sound.
  await openTheater(page);
  await commitGrade(page, "matrix");
  await expect(root).toHaveAttribute("data-audio-state", "running", { timeout: 20_000 });
  await expect(root).toHaveAttribute("data-audio-film", "matrix");
});

test("simulation cannot outlive its film", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("film-grade", "wargames"));
  await page.goto("/");

  await page.getByRole("button", { name: "Shall we play a game?" }).click();
  await page
    .getByRole("dialog", { name: "Shall we play a game?" })
    .getByRole("button", { name: "tic-tac-toe simulation" })
    .click();
  const dialog = page.getByRole("dialog", { name: "JXN-83 tic-tac-toe simulation" });
  await expect(dialog).toBeVisible();

  // Committing another film while the simulation is open must close it —
  // and nothing may resurrect it afterwards.
  await dispatchGrade(page, "dune", "commit");
  await expect(dialog).toHaveCount(0);
  await page.waitForTimeout(1000);
  await expect(dialog).toHaveCount(0);

  // Returning to WarGames must not resurrect the dialog unclicked: a chunk
  // that resolved after the switch is stale state, not an open request.
  await dispatchGrade(page, "wargames", "commit");
  await expect(
    page.getByRole("button", { name: "Shall we play a game?" })
  ).toBeVisible();
  await page.waitForTimeout(500);
  await expect(dialog).toHaveCount(0);
});

test("complete catalog switches through one bounded experience lifecycle", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const source = message.location().url;
    if (source.includes("/_vercel/insights/") || message.text().includes("/_vercel/insights/")) return;
    errors.push(`${source}: ${message.text()}`);
  });
  await page.goto("/");

  const root = page.locator("[data-film-experience-root]");
  await expect(root).toHaveAttribute("data-experience-ready", "true");
  for (const grade of grades) {
    await dispatchGrade(page, grade.id, "commit");
    await expect(root).toHaveAttribute("data-committed-film", grade.id);
    await expect(root).toHaveAttribute("data-frame-state", "running");
    await expect(page.locator("canvas[data-cinematic-layer]")).toHaveAttribute(
      "data-renderer",
      grade.id
    );
    await expect(page.locator("canvas[data-cinematic-layer]")).toHaveCount(1);
    await expect(page.getByRole("group", { name: "Cinematic mode controls" })).toHaveCount(1);
  }

  await dispatchGrade(page, "casablanca", "preview");
  await expect(root).toHaveAttribute("data-active-film", "casablanca");
  await expect(root).toHaveAttribute("data-committed-film", "wargames");

  await dispatchGrade(page, "wargames", "restore");
  await expect(root).toHaveAttribute("data-active-film", "wargames");

  await dispatchGrade(page, null, "commit");
  await expect(page.locator("canvas[data-cinematic-layer]")).toHaveCount(0);
  await expect(root).toHaveAttribute("data-frame-state", "off");
  expect(errors).toEqual([]);
});

test("mobile mode keeps the portfolio usable at the bounded quality tier", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("film-grade", "wall-e"));
  await page.goto("/");

  const canvas = page.locator("canvas[data-cinematic-layer]");
  await expect(canvas).toHaveAttribute("data-renderer", "wall-e");
  expect(
    await canvas.evaluate((element: HTMLCanvasElement) => element.width)
  ).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole("group", { name: "Cinematic mode controls" })).toBeVisible();

  const name = page.getByLabel("Name");
  await name.scrollIntoViewIfNeeded();
  await name.fill("Interaction remains available");
  await expect(name).toHaveValue("Interaction remains available");
  await expect(canvas).toHaveCSS("pointer-events", "none");
});

const filmRenderCases = [
  ["casablanca", "Casablanca", "departures"],
  ["dune", "Dune", "twin moons"],
  ["matrix", "The Matrix", "glyph rain"],
  ["blade-runner", "Blade Runner 2049", "spinner traffic"],
  ["space-odyssey", "2001: A Space Odyssey", "JB-35"],
  ["the-batman", "The Batman", "cipher"],
  ["parasite", "Parasite", "Morse lamp"],
  ["arrival", "Arrival", "12 markers"],
  ["fury-road", "Mad Max: Fury Road", "eight-cylinder gauge"],
  ["her", "Her", "warm waveform"],
  ["wall-e", "WALL-E", "JB113"],
  ["royal-tenenbaums", "The Royal Tenenbaums", "record player"],
  ["fight-club", "Fight Club", "payphone"],
  ["goodfellas", "Goodfellas", "final-day dates"],
  ["amadeus", "Amadeus", "movement count"],
  ["wargames", "WarGames", "tic-tac-toe"],
] as const;

for (const [id, label, expectedReference] of filmRenderCases) {
  test(`${label} renders an authored, reference-dense film world`, async ({ page }) => {
    await page.addInitScript((filmId) => {
      localStorage.setItem("film-grade", filmId);
    }, id);
    await page.goto("/");

    const root = page.locator("[data-film-experience-root]");
    const canvas = page.locator("canvas[data-cinematic-layer]");
    await expect(root).toHaveAttribute("data-frame-state", "running");
    await expect(canvas).toHaveAttribute("data-renderer", id);
    await expect(canvas).toHaveAttribute(
      "data-visual-references",
      new RegExp(expectedReference, "i")
    );
    await expect.poll(() => visiblePixelCount(canvas)).toBeGreaterThan(20);
  });
}
