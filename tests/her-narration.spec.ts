import { expect, test } from "@playwright/test";
import { commitGrade, openTheater } from "./helpers";

// The Her film reads each section's commentary aloud as it reaches the middle of
// the viewport, and a new section cuts off the previous line. The bug this
// guards: scrolling DOWN switched sections but scrolling back UP did not — the
// section you rose to never took over. OsAmbience mirrors the active section
// onto <html> as data-os-section, which is what we assert here (the audio is a
// downstream consumer of the same pick). Reduced motion disables Lenis so the
// programmatic scroll is instant and deterministic.
test("Her narration tracks the centred section scrolling up and down", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await openTheater(page);
  await commitGrade(page, "her");

  const html = page.locator("html");
  const scrollTo = (id: string) =>
    page.evaluate(
      (sid) => document.getElementById(sid)?.scrollIntoView({ block: "center" }),
      id
    );

  // At the top the hero owns the centre. Also settles the page (the backdrop
  // swap on commit) before scrolling — and proves "top" is tracked, the section
  // the stale-list bug dropped for the whole session.
  await expect(html).toHaveAttribute("data-os-section", "top");

  // Scrolling down: each section takes over as it reaches the centre.
  for (const section of ["about", "experience", "projects", "skills"]) {
    await scrollTo(section);
    await expect(html).toHaveAttribute("data-os-section", section);
  }

  // Scrolling back up: the earlier section must take over again — the exact
  // case that used to stay stuck on the section furthest down.
  for (const section of ["projects", "experience", "about"]) {
    await scrollTo(section);
    await expect(html).toHaveAttribute("data-os-section", section);
  }
});
