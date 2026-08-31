"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import Pill from "../ui/Pill";

type Status = "idle" | "sending" | "success" | "error";

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError("");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div className="glass flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl p-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h3 className="mt-5 text-xl font-semibold text-white">Message sent</h3>
        <p className="mt-2 text-sm text-white/60">
          Thanks for reaching out. I&apos;ll get back to you soon.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-6 text-sm font-medium text-accent transition-colors hover:text-accent-bright"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="glass rounded-2xl p-6 text-left sm:p-7">
      {/* Honeypot — hidden from humans. display:none (not offscreen) so
          password managers skip it: an autofilled honeypot silently discards a
          real message. The name avoids every autofill category ("company" was
          autofilled as an organization field) while still reading like a field
          naive bots want to fill. */}
      <div style={{ display: "none" }} aria-hidden>
        <input type="text" name="topic" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            name="name"
            type="text"
            required
            maxLength={120}
            placeholder="Harry Potter"
            className="input"
          />
        </Field>
        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            placeholder="you@company.com"
            className="input"
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Message">
          <textarea
            name="message"
            required
            rows={5}
            maxLength={5000}
            placeholder="Tell me about the role, project, or idea…"
            className="input resize-none"
          />
        </Field>
      </div>

      {status === "error" && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-white/60">
        By sending this, you agree your name, email, and message will be emailed
        to me so I can reply. See the{" "}
        <Link href="/privacy" className="text-white/55 underline-offset-2 hover:text-accent hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <Pill
        type="submit"
        disabled={status === "sending"}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 sm:w-auto"
      >
        {status === "sending" ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Sending…
          </>
        ) : (
          <>
            Send message
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </Pill>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.02);
          padding: 0.7rem 0.9rem;
          font-size: 0.875rem;
          color: #e7e9f3;
          outline: none;
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        :global(.input::placeholder) {
          color: rgba(231, 233, 243, 0.3);
        }
        :global(.input:focus) {
          border-color: color-mix(in srgb, var(--accent) 60%, transparent);
          background: color-mix(in srgb, var(--accent) 4%, transparent);
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.15em] text-white/65">
        {label}
      </span>
      {children}
    </label>
  );
}
