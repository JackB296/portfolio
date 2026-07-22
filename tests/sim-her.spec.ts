import { expect, test } from "@playwright/test";
import { openFilmSim } from "./helpers";

// Deterministic runs through all three Her simulations: fixed pick sequences
// only — the letter's scoring is pure, the boot interview is a scripted tree,
// and the waveform round always advances once the required taps are supplied
// (accuracy only moves the harmony meter, never the state machine).

test("Compose a letter: returned when guarded, sealed when true, next commission", async ({
  page,
}) => {
  const pill = page.getByRole("button", { name: "Hello, I'm here" });
  const dialog = await openFilmSim(page, {
    grade: "her",
    pill: "Hello, I'm here",
    game: "compose a letter",
    dialog: "Compose a letter",
  });
  await expect(dialog.getByText("Letter writer 612.")).toBeVisible();
  await dialog.getByRole("button", { name: "Start dictating" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "writing");
  await expect(board).toHaveAttribute("data-commission", "1");
  await expect(dialog.getByText("Roberto → Maria")).toBeVisible();

  // All-reserved beats on an unguarded commission: returned for revision.
  const guardedPicks = [
    "another year has gone by for us.",
    "the wedding, which went well.",
    "that marriage takes work.",
    "as ever. — 612",
  ];
  for (const text of guardedPicks) {
    await dialog.getByRole("button", { name: text }).click();
  }
  await dialog.getByRole("button", { name: "Read it back" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "returned");
  await expect(board).toHaveAttribute("data-sincerity", "8");
  await expect(dialog.getByText("Maria will read this like a receipt", { exact: false })).toBeVisible();

  // Revise into the unguarded register: seals at full sincerity.
  await dialog.getByRole("button", { name: "Revise" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "writing");
  const unguardedPicks = [
    "fifty years, and I still lose my place when you laugh.",
    "dancing at two a.m., both of us terrible at it.",
    "that every version of my life without you goes dark.",
    "for the next fifty, starting tonight. — 612",
  ];
  for (const text of unguardedPicks) {
    await dialog.getByRole("button", { name: text }).click();
  }
  await dialog.getByRole("button", { name: "Read it back" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "sealed");
  await expect(board).toHaveAttribute("data-sincerity", "100");
  await expect(dialog.getByLabel("Rated 5 of 5 hearts")).toBeVisible();

  // The desk moves on to the apology commission.
  await dialog.getByRole("button", { name: "Next commission" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "writing");
  await expect(board).toHaveAttribute("data-commission", "2");
  await expect(dialog.getByText("Clara → her sister Rosa")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});

test("Boot OS1: follow-ups react, the voice wakes with a personalized greeting, restart resets", async ({
  page,
}) => {
  // Eight answers plus a boot pause; slow under parallel load, not broken.
  test.slow();
  const pill = page.getByRole("button", { name: "Hello, I'm here" });
  const dialog = await openFilmSim(page, {
    grade: "her",
    pill: "Hello, I'm here",
    game: "boot OS1",
    dialog: "Boot OS1",
  });
  await expect(dialog.getByText("Are you social or antisocial?")).toBeVisible();
  await dialog.getByRole("button", { name: "Begin setup" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "interview");
  await expect(board).toHaveAttribute("data-question", "1");
  await expect(dialog.getByText("voice temperament:")).toBeVisible();

  // A fixed path through the tree: each base answer summons its follow-up.
  const path = [
    "I like people, in small doses.",
    "Crowds, definitely.",
    "Warm, most days.",
    "When we talk about my life.",
    "A female voice.",
    "Close, like you are in the room.",
    "To be understood.",
    "Someone in particular.",
  ];
  for (let step = 0; step < path.length; step++) {
    await expect(board).toHaveAttribute("data-question", String(step + 1));
    await dialog.getByRole("button", { name: path[step] }).click();
  }

  // The boot pause resolves into the awake state on its own.
  await expect(board).toHaveAttribute("data-sim-state", "awake", {
    timeout: 8_000,
  });
  // The greeting is assembled from the answers given above.
  await expect(dialog.getByText("you can call me Samantha", { exact: false }))
    .toBeVisible({ timeout: 8_000 });

  await dialog.getByRole("button", { name: "Set up again" }).click();
  await expect(board).toHaveAttribute("data-sim-state", "interview");
  await expect(board).toHaveAttribute("data-question", "1");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});

test("Waveform duet: listen, answer the pattern, advance rounds, start over", async ({
  page,
}) => {
  const pill = page.getByRole("button", { name: "Hello, I'm here" });
  const dialog = await openFilmSim(page, {
    grade: "her",
    pill: "Hello, I'm here",
    game: "waveform",
    dialog: "Waveform",
  });
  await expect(dialog.getByText("Hello, I'm here.")).toBeVisible();
  await dialog.getByRole("button", { name: "Listen for the voice" }).click();

  const board = dialog.locator("[data-sim-state]");
  await expect(board).toHaveAttribute("data-sim-state", "speaking");
  await expect(board).toHaveAttribute("data-round", "1");
  await expect(dialog.getByText("She speaks a cadence", { exact: false })).toBeVisible();

  // Her pattern plays out on its own, then it becomes our turn.
  await expect(board).toHaveAttribute("data-sim-state", "responding", {
    timeout: 15_000,
  });

  // Answer the three pulses (any accuracy advances the round; only the
  // harmony meter cares how well we kept the pace).
  const wave = dialog.getByRole("button", { name: "Pulse in time" });
  await wave.click();
  await wave.click();
  await wave.click();
  await expect(board).toHaveAttribute("data-round", "2");
  await expect(board).toHaveAttribute("data-sim-state", "speaking");

  // Start over resets the session arc and the harmony bank.
  await dialog.getByRole("button", { name: "Start over" }).click();
  await expect(board).toHaveAttribute("data-round", "1");
  await expect(board).toHaveAttribute("data-harmony", "0");

  // The self-rendered sound has a visible toggle.
  const sound = dialog.getByRole("button", { name: /Sound (on|off)/ });
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
});
