import type { Metadata } from "next";
import ClothSim from "@/components/demos/ClothSim";
import { profile } from "@/lib/data";
import DemoShell from "@/components/demos/DemoShell";

export const metadata: Metadata = {
  title: `Cloth Simulation · ${profile.name}`,
  description:
    "An interactive Verlet-integration cloth simulation running live in the browser. Just drag your mouse across it to slice through the threads.",
};

export default function ClothPage() {
  return (
    <DemoShell
      slug="cloth"
      accentLabel="Physics · Live Demo"
      title="Cloth"
      titleAccent="Simulation"
      description="A JS port of my Python cloth simulation. Includes a 32×24 grid of point masses linked by sticks. It uses Verlet integration (velocity is implicit in the previous position) and relaxes the constraints five times per frame, so the fabric holds together while swinging and stretching under gravity. Every other node on the top row is pinned."
      bullets={[
        ["Verlet integration", "Velocity is implicit in the previous position."],
        ["Constraint relaxation", "Each stick is solved five times per frame to keep the weave taut."],
        ["Slice it", "Drag your mouse across the cloth and any thread you cross is cut."],
      ]}
      tags={["Python", "JavaScript", "Canvas", "Verlet", "Physics", "Simulation"]}
      github="https://github.com/JackB296"
    >
      <ClothSim />
    </DemoShell>
  );
}
