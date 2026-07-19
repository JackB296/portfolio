import type { Metadata } from "next";
import { profile } from "@/lib/data";
import ResumeViewer from "@/components/resume/ResumeViewer";
import BackLink from "@/components/ui/BackLink";
import Glow from "@/components/ui/Glow";

export const metadata: Metadata = {
  title: `Resume · ${profile.name}`,
  description: `Resume of ${profile.name}, ${profile.title}.`,
};

export default function ResumePage() {
  return (
    <main className="relative min-h-screen overflow-hidden py-10">
      <Glow className="top-0 h-[400px] w-[700px] blur-[140px]" />

      <div className="container-x">
        <div className="mb-8 flex items-center justify-between">
          <BackLink href="/" label="Back" />
          <h1 className="font-mono text-sm uppercase tracking-[0.2em] text-accent">
            Resume
          </h1>
        </div>

        <ResumeViewer src={profile.resumePdf} />
      </div>
    </main>
  );
}
