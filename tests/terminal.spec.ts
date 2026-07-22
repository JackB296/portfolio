import { expect, test } from "@playwright/test";
import { waitForHydration } from "./helpers";

// The macOS guest terminal: window management (drag, resize, minimize, zoom),
// the shell features (ghost suggestions, persistent history, the unix-flavored
// commands), and the per-film profile picker in the title bar.

// Reduced motion: the terminal is non-modal, so the WebGL hero keeps
// rendering behind it. CI runners have no GPU — SwiftShader burns both cores
// and every action crawls past the 30s ceiling. Under reduced motion the site
// collapses every canvas to a still frame, and nothing here needs animation.
test.use({ contextOptions: { reducedMotion: "reduce" } });

const openTerminal = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.keyboard.press("`");
  const dialog = page.getByRole("dialog", { name: "Guest terminal" });
  await expect(dialog).toBeVisible();
  return dialog;
};

test.describe("mac terminal window", () => {
  test("drags by the title bar and resizes from the corner", async ({ page }) => {
    const dialog = await openTerminal(page);
    const before = await dialog.boundingBox();
    expect(before).not.toBeNull();

    const bar = page.locator("[data-terminal-titlebar]");
    const barBox = await bar.boundingBox();
    await page.mouse.move(barBox!.x + barBox!.width / 2, barBox!.y + barBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      barBox!.x + barBox!.width / 2 - 120,
      barBox!.y + barBox!.height / 2 + 60,
      { steps: 5 }
    );
    await page.mouse.up();

    const dragged = await dialog.boundingBox();
    expect(Math.round(dragged!.x - before!.x)).toBe(-120);
    expect(Math.round(dragged!.y - before!.y)).toBe(60);

    const grip = page.locator("[data-terminal-resize]");
    const gripBox = await grip.boundingBox();
    await page.mouse.move(gripBox!.x + 8, gripBox!.y + 8);
    await page.mouse.down();
    await page.mouse.move(gripBox!.x + 8 - 100, gripBox!.y + 8 - 80, { steps: 5 });
    await page.mouse.up();

    const resized = await dialog.boundingBox();
    expect(Math.round(resized!.width - dragged!.width)).toBe(-100);
    expect(Math.round(resized!.height - dragged!.height)).toBe(-80);

    // Geometry survives a close/reopen via localStorage.
    await page.keyboard.press("Escape");
    await page.keyboard.press("`");
    const reopened = await dialog.boundingBox();
    expect(Math.round(reopened!.x)).toBe(Math.round(resized!.x));
    expect(Math.round(reopened!.width)).toBe(Math.round(resized!.width));
  });

  test("traffic lights: minimize to dock pill, zoom, close", async ({ page }) => {
    const dialog = await openTerminal(page);
    const before = await dialog.boundingBox();

    await page.getByRole("button", { name: "Minimize terminal" }).click();
    await expect(dialog).toBeHidden();
    const pill = page.getByRole("button", { name: "Restore terminal" });
    await expect(pill).toBeVisible();
    await pill.click();
    await expect(dialog).toBeVisible();

    await page.getByRole("button", { name: "Zoom terminal" }).click();
    const zoomed = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(Math.round(zoomed!.width)).toBe(viewport.width - 24);
    await page.getByRole("button", { name: "Zoom terminal" }).click();
    const restored = await dialog.boundingBox();
    expect(Math.round(restored!.width)).toBe(Math.round(before!.width));

    await page.getByRole("button", { name: "Close terminal" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("[data-terminal]")).toHaveAttribute(
      "data-terminal",
      "closed"
    );
  });

  test("is non-modal: the site scrolls behind the open window", async ({
    page,
  }) => {
    await openTerminal(page);
    await page.mouse.move(40, 500);
    await page.mouse.wheel(0, 800);
    await expect
      .poll(async () => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
  });

  test("profile picker commits a real film grade", async ({ page }) => {
    await openTerminal(page);
    await page.getByLabel("Terminal profile").selectOption("matrix");
    await expect(page.locator("html")).toHaveAttribute("data-grade", "matrix");
    expect(await page.evaluate(() => localStorage.getItem("film-grade"))).toBe(
      "matrix"
    );
    await page.getByLabel("Terminal profile").selectOption("house");
    await expect(page.locator("html")).not.toHaveAttribute("data-grade", /.+/);
  });
});

test.describe("guest shell features", () => {
  test("ghost suggestion appears and ArrowRight accepts it", async ({ page }) => {
    await openTerminal(page);
    const input = page.getByLabel("Terminal command");
    await input.pressSequentially("neo");
    await expect(page.locator("[data-terminal-ghost]")).toHaveText("fetch");
    await input.press("ArrowRight");
    await expect(input).toHaveValue("neofetch");
    await input.press("Enter");
    await expect(page.locator("[data-terminal-output]")).toContainText(
      "OS: PortfolioOS"
    );
    await expect(page.locator("[data-terminal-output]")).toContainText(
      "Theme: house emerald (default)"
    );
  });

  test("history persists across reloads and powers suggestions", async ({
    page,
  }) => {
    await openTerminal(page);
    const input = page.getByLabel("Terminal command");
    await input.fill("echo hello $USER");
    await input.press("Enter");
    await expect(page.locator("[data-terminal-output]")).toContainText(
      "hello guest"
    );

    await page.reload();
    await waitForHydration(page);
    await page.keyboard.press("`");
    const reopened = page.getByLabel("Terminal command");
    await reopened.press("ArrowUp");
    await expect(reopened).toHaveValue("echo hello $USER");
    await reopened.press("ArrowDown");
    await reopened.pressSequentially("echo h");
    await expect(page.locator("[data-terminal-ghost]")).toHaveText(
      "ello $USER"
    );
    await reopened.press("Escape");
  });

  test("unix flavor: whoami, pwd, uname, date, man, ls -a, cat", async ({
    page,
  }) => {
    test.slow(); // eight sequential command round-trips
    await openTerminal(page);
    const input = page.getByLabel("Terminal command");
    const output = page.locator("[data-terminal-output]");

    await input.fill("whoami");
    await input.press("Enter");
    await expect(
      output.locator("div").filter({ hasText: /^guest$/ })
    ).toHaveCount(1);

    await input.fill("pwd");
    await input.press("Enter");
    await expect(output).toContainText("/Users/guest");

    await input.fill("uname -a");
    await input.press("Enter");
    await expect(output).toContainText("PortfolioOS jbialecki.com");

    await input.fill("date");
    await input.press("Enter");
    await expect(output).toContainText(/\w{3} \w{3} \d{1,2} \d{2}:\d{2}:\d{2}/);

    await input.fill("man theme");
    await input.press("Enter");
    await expect(output).toContainText("re-grade the entire site");

    await input.fill("ls -a");
    await input.press("Enter");
    await expect(output).toContainText(".plan");

    await input.fill("cat .plan");
    await input.press("Enter");
    await expect(output).toContainText("take over the world");

    await input.fill("history");
    await input.press("Enter");
    await expect(output).toContainText("1  whoami");
  });

  test("cd walks the virtual filesystem and cat prints raw page data", async ({
    page,
  }) => {
    test.slow(); // nine sequential command round-trips
    await openTerminal(page);
    const input = page.getByLabel("Terminal command");
    const output = page.locator("[data-terminal-output]");

    // Step into films/, and the live prompt reflects the directory.
    await input.fill("cd films");
    await input.press("Enter");
    await expect(page.locator("[data-terminal-output]").last()).toContainText(
      "~/films %"
    );

    // ls here lists the generated per-film data files.
    await input.fill("ls");
    await input.press("Enter");
    await expect(output).toContainText("matrix.txt");

    // cat prints the raw grade + review data for a film (extension optional).
    await input.fill("cat matrix");
    await input.press("Enter");
    await expect(output).toContainText("# The Matrix (1999)");
    await expect(output).toContainText("accent: 34 197 94");

    // Relative paths climb back and cross into another directory.
    await input.fill("cat ../work/voyage-foods-dashboard.txt");
    await input.press("Enter");
    await expect(output).toContainText("# Voyage Foods");

    // Case-study files carry the project's stack and code pointer.
    await input.fill("cd ..");
    await input.press("Enter");
    await input.fill("cd demos");
    await input.press("Enter");
    await input.fill("cat cloth.txt");
    await input.press("Enter");
    await expect(output).toContainText("## code");
    await expect(output).toContainText("github.com/JackB296/Cloth-Simulation");

    // Tab completion is filesystem-aware inside a directory.
    await input.fill("cat flap");
    await input.press("Tab");
    await expect(input).toHaveValue("cat flappy.txt");

    // Bad paths report politely without throwing.
    await input.fill("cd nope");
    await input.press("Enter");
    await expect(output).toContainText("cd: no such directory: nope");
  });

  test("Ctrl+L clears the scrollback and Ctrl+C cancels the line", async ({
    page,
  }) => {
    await openTerminal(page);
    const input = page.getByLabel("Terminal command");
    const output = page.locator("[data-terminal-output]");

    await input.fill("whoami");
    await input.press("Enter");
    await input.press("Control+l");
    await expect(output).not.toContainText("whoami");
    await expect(output).toContainText("Last login");

    await input.pressSequentially("doomed-command");
    await input.press("Control+c");
    await expect(input).toHaveValue("");
    await expect(output).toContainText("doomed-command^C");
  });
});
