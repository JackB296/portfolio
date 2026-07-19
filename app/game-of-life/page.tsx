import type { Metadata } from "next";
import GameOfLife from "@/components/demos/GameOfLife";
import { profile } from "@/lib/data";
import DemoShell from "@/components/demos/DemoShell";

export const metadata: Metadata = {
  title: `Game of Life · ${profile.name}`,
  description:
    "Conway's Game of Life with age-colored cells, interactive in the browser.",
};

export default function GameOfLifePage() {
  return (
    <DemoShell
      slug="game-of-life"
      description="The classic cellular automaton, ported from my Python version. Every cell lives or dies based only on its eight neighbors, yet gliders, oscillators, and whole ecosystems emerge from those four tiny rules. Cells are colored by age so you can watch structure form and decay."
      bullets={[
        ["The rules", "A live cell with two or three neighbors survives, a dead cell with exactly three is born."],
        ["Age colors", "Newborn cells are green, young cells purple, and long-lived cells pink."],
        ["Play with it", "Click or drag to draw cells, then play, pause, step, and change the speed."],
      ]}
    >
      <GameOfLife />
    </DemoShell>
  );
}
