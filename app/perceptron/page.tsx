import type { Metadata } from "next";
import Perceptron from "@/components/demos/Perceptron";
import { profile } from "@/lib/data";
import DemoShell from "@/components/demos/DemoShell";

export const metadata: Metadata = {
  title: `Perceptron Classifier — ${profile.name}`,
  description:
    "An interactive single-perceptron classifier learning a linear boundary, live in the browser.",
};

export default function PerceptronPage() {
  return (
    <DemoShell
      slug="perceptron"
      accentLabel="AI / ML · Live Demo"
      title="Perceptron"
      titleAccent="Classifier"
      description="The simplest possible learning machine, ported from my Python project. One perceptron, three weights, and a hundred points. Each point is labeled by whether it falls above or below a hidden line, and the perceptron nudges its weights on every point until its guess matches the truth."
      bullets={[
        ["The rule", "It sums weighted inputs plus a bias and fires plus one or minus one."],
        ["Learning", "Each step it shifts weights toward any point it got wrong."],
        ["Watch it", "Green points are classified right, red are wrong, and the purple line is the current boundary."],
      ]}
      tags={["Python", "JavaScript", "Canvas", "Machine Learning", "Perceptron"]}
      github="https://github.com/JackB296/basic-perceptron"
    >
      <Perceptron />
    </DemoShell>
  );
}
