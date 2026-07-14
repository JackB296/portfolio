import type { Metadata } from "next";
import Link from "next/link";
import { profile } from "@/lib/data";
import ResumeViewer from "@/components/resume/ResumeViewer";
import BackLink from "@/components/ui/BackLink";

export const metadata: Metadata = {
  title: `Resume — ${profile.name}`,
  description: `Resume of ${profile.name}, ${profile.title}.`,
};

export default function ResumePage() {
  return (
    <main className="relative min-h-screen overflow-hidden py-10">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[400px] w-[700px] max-w-full -translate-x-1/2 rounded-full bg-accent/10 blur-[140px]" />

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
