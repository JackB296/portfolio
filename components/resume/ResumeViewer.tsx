"use client";

import { useRef } from "react";
import Pill from "../ui/Pill";

export default function ResumeViewer({ src }: { src: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      } catch {
        // Some browsers block printing a PDF iframe directly — fall back.
      }
    }
    window.open(src, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        <Pill
          type="button"
          onClick={handlePrint}
          variant="outline"
          size="sm"
          className="inline-flex items-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Print
        </Pill>
        <Pill
          href={src}
          download
          size="sm"
          className="inline-flex items-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download PDF
        </Pill>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-accent/10">
        <iframe
          ref={iframeRef}
          src={`${src}#view=FitH`}
          title="Resume"
          className="block h-[85vh] w-full"
        />
      </div>

      <p className="mt-4 text-center font-mono text-xs text-white/60">
        Can&apos;t see it?{" "}
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-accent-bright"
        >
          Open the PDF in a new tab
        </a>
        .
      </p>
    </div>
  );
}
