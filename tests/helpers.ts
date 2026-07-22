import { expect, type Locator, type Page } from "@playwright/test";
import { getGrade, GRADE_EVENT, type GradeChangeIntent } from "../lib/grades";
import { HOUSE_FILM, HOUSE_ID } from "../lib/films";

/** Click the film-theater trigger and return the dialog locator. */
export async function openTheater(page: Page): Promise<Locator> {
  await page.locator('button[aria-haspopup="dialog"]').first().click();
  return page.getByRole("dialog", { name: "Film theater" });
}

/**
 * Commit a grade from the open theater: focus its cover (emitting a preview,
 * as any pointer or keyboard visit would) and click it. Takes a grade id
 * ("dune", "house") and resolves the display name from the grade registry.
 */
export async function commitGrade(page: Page, gradeId: string): Promise<void> {
  const film = gradeId === HOUSE_ID ? HOUSE_FILM : getGrade(gradeId)?.film;
  if (!film) throw new Error(`Unknown grade id: ${gradeId}`);
  const cover = page
    .getByRole("dialog", { name: "Film theater" })
    .locator(`[data-film-scene="${gradeId}"]`)
    .getByRole("button", { name: `Use ${film} grade` });
  await cover.focus();
  await cover.click();
}

/** Dispatch a raw gradechange event, bypassing the theater UI. */
export async function dispatchGrade(
  page: Page,
  gradeId: string | null,
  intent: GradeChangeIntent
): Promise<void> {
  await page.evaluate(
    ([eventName, id, gradeIntent]) => {
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: { gradeId: id, intent: gradeIntent },
        })
      );
    },
    [GRADE_EVENT, gradeId, intent] as const
  );
}

/**
 * Open a film simulation from a cold load: seed the grade, visit the home page,
 * click the simulate pill, and (for multi-game films) pick a game from the
 * launcher. Returns the visible game dialog. This is the opener every
 * tests/sim-*.spec.ts repeats.
 *
 * - `grade`  — the film-grade id to seed in localStorage.
 * - `pill`   — accessible name of the simulate pill (also the launcher dialog's
 *              name for multi-game films).
 * - `dialog` — accessible name of the game dialog.
 * - `game`   — for multi-game films, the game's button name in the launcher.
 * - `reducedMotion` — emulate reduced motion before loading (deterministic play).
 * - `start`  — if set, click this start control once the dialog is open.
 */
export async function openFilmSim(
  page: Page,
  opts: {
    grade: string;
    pill: string;
    dialog: string;
    game?: string;
    reducedMotion?: boolean;
    start?: string;
  }
): Promise<Locator> {
  if (opts.reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((grade) => {
    localStorage.setItem("film-grade", grade);
  }, opts.grade);
  await page.goto("/");

  await page.getByRole("button", { name: opts.pill }).click();
  if (opts.game) {
    const menu = page.getByRole("dialog", { name: opts.pill });
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: opts.game }).click();
  }

  const dialog = page.getByRole("dialog", { name: opts.dialog });
  await expect(dialog).toBeVisible();
  if (opts.start) await dialog.getByRole("button", { name: opts.start }).click();
  return dialog;
}

/** Read the persisted simulation high-score map from localStorage. */
export function readSimulationScores(page: Page): Promise<Record<string, number>> {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("simulation-scores") ?? "{}") as Record<
        string,
        number
      >
  );
}

/** Sample the canvas alpha channel and count visibly drawn pixels. */
export function visiblePixelCount(canvas: Locator): Promise<number> {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    let visible = 0;
    for (let index = 3; index < pixels.length; index += 64) {
      if (pixels[index] > 4) visible += 1;
    }
    return visible;
  });
}

/**
 * Wait until the client has hydrated: the film experience root reports ready
 * from its mount effect, which runs in the same commit wave that attaches the
 * other global listeners (guest terminal, Konami). Keyboard-driven tests must
 * wait for this or a fast worker can type before anyone is listening.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page
    .locator('[data-film-experience-root][data-experience-ready="true"]')
    .waitFor({ state: "attached" });
}
