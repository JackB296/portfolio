import type { Metadata } from "next";
import { profile } from "@/lib/data";
import { routeMetadata } from "@/lib/pageMetadata";
import DemoShell from "@/components/demos/DemoShell";
import { DemoFrame } from "@/components/demos/chrome";

export const metadata: Metadata = routeMetadata({
  title: `Neuroevolution Flappy Bird · ${profile.name}`,
  description:
    "An AI-driven Flappy Bird that evolves a population of neural-network agents through neuroevolution. Here it is playable, embedded live in the portfolio.",
  path: "/flappy",
});

export default function FlappyPage() {
  return (
    <DemoShell
      slug="flappy"
      description={
        <>
          This is the real project, running live. It evolves a population of 50
          neural-network birds through <b className="text-white/85">neuroevolution</b>:
          a genetic algorithm that breeds the fittest birds each generation until they
          learn, from just two inputs, to clear the pipes on their own.
        </>
      }
      bullets={[
        ["Mode: You / AI", "Play it yourself, or switch to AI and watch the population train."],
        ["Debug View", "Visualize each bird's input ray to the next pipe gap."],
        ["Space to flap", "In player mode, press Space to jump; tap on mobile."],
      ]}
      demoColumnClassName="w-full lg:w-[480px]"
    >
      {/* Embedded live p5.js game */}
      <DemoFrame className="bg-ink">
        <iframe
          src="/neat-flappy/index.html"
          title="Neuroevolution Flappy Bird live demo"
          sandbox="allow-scripts allow-same-origin"
          className="block h-[760px] w-full"
          loading="lazy"
        />
      </DemoFrame>
    </DemoShell>
  );
}
