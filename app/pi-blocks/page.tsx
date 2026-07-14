import type { Metadata } from "next";
import PiBlocks from "@/components/demos/PiBlocks";
import { profile } from "@/lib/data";
import DemoShell from "@/components/demos/DemoShell";

export const metadata: Metadata = {
  title: `Pi from Collisions — ${profile.name}`,
  description:
    "Two colliding blocks compute the digits of pi, an interactive physics demo.",
};

export default function PiBlocksPage() {
  return (
    <DemoShell
      slug="pi-blocks"
      accentLabel="Math · Live Demo"
      title="Pi from"
      titleAccent="Collisions"
      description="One of my favorite surprises in math, ported from my Python sim. Slide a big block into a small one against a wall, count every perfectly elastic collision, and the digits of pi appear. Make the big block 100 times heavier and you get one more digit each time."
      bullets={[
        ["Setup", "A small block at rest, a heavy block moving in, and a wall on the left."],
        ["Mass ratio", "Pick 1, 100, or 10000 and the collision count becomes 3, then 31, then 314."],
        ["Why", "Elastic collisions conserve energy and momentum, which traces a circle, and pi follows."],
      ]}
      tags={["Python", "JavaScript", "Canvas", "Physics", "Math"]}
      github="https://github.com/JackB296/pi-blocks"
    >
      <PiBlocks />
    </DemoShell>
  );
}
