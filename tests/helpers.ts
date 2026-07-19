import type { Locator, Page } from "@playwright/test";
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
