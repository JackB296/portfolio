import type { Metadata } from "next";
import Raycaster from "@/components/demos/Raycaster";
import { profile } from "@/lib/data";
import DemoShell from "@/components/demos/DemoShell";

export const metadata: Metadata = {
  title: `Raycasting Engine · ${profile.name}`,
  description:
    "An interactive, Wolfenstein-style raycasting renderer running live in the browser. Walk through this pseudo-3D world built from a 2D grid.",
};

export default function RaycasterPage() {
  return (
    <DemoShell
      slug="raycaster"
      accentLabel="Graphics · Live Demo"
      title="Raycasting"
      titleAccent="Engine"
      description="A pseudo-3D renderer in the Wolfenstein 3D tradition, ported faithfully from my Python engine. It marches 150 rays across the field of view, finds where each one hits a wall, and draws a vertical strip scaled by that distance. The left pane shows the real 2D map with the rays fanning out; the right pane is the 3D view they produce."
      bullets={[
        ["Ray marching", "Each ray steps forward through the grid until it strikes a wall."],
        ["Map + 3D, side by side", "Watch the 2D rays on the left build the 3D scene on the right."],
        ["Move & turn", "W/S to move, A/D (or arrows) to turn, or click-drag to look around."],
      ]}
      tags={["Python", "JavaScript", "Canvas", "Raycasting", "Graphics"]}
      github="https://github.com/JackB296/raycasting-engine"
    >
      <Raycaster />
    </DemoShell>
  );
}
