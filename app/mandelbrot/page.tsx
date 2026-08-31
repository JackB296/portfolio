import type { Metadata } from "next";
import Mandelbrot from "@/components/demos/Mandelbrot";
import { profile } from "@/lib/data";
import { routeMetadata } from "@/lib/pageMetadata";
import DemoShell from "@/components/demos/DemoShell";

export const metadata: Metadata = routeMetadata({
  title: `Mandelbrot Set · ${profile.name}`,
  description:
    "An interactive Mandelbrot set renderer with zoom, ported from my Python notebook.",
  path: "/mandelbrot",
});

export default function MandelbrotPage() {
  return (
    <DemoShell
      slug="mandelbrot"
      description="The most famous fractal, ported from my Python and NumPy notebook. For each pixel it repeatedly applies z equals z squared plus c and asks how long until the value escapes to infinity. That escape time becomes the color, and the boundary holds infinite detail."
      bullets={[
        ["Escape time", "Each point is iterated until its magnitude passes two, or it is declared inside."],
        ["Hot colormap", "Faster escapes are dark, slower ones glow toward white, and the set itself is black."],
        ["Zoom in", "Click or scroll to dive in. The iteration depth climbs automatically as you go deeper."],
      ]}
    >
      <Mandelbrot />
    </DemoShell>
  );
}
