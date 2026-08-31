import { NextResponse } from "next/server";
import { Resend } from "resend";
import { profile } from "@/lib/data";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Basic in-memory rate limit (per warm serverless instance) to deter spam.
const limiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  maxEntries: 1_000,
});

// Refuse bodies this large before parsing; the biggest legitimate submission
// (name + email + 5000-char message as JSON) sits comfortably under it.
const MAX_BODY_BYTES = 32_768;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    // x-forwarded-for is trustworthy on Vercel (the platform sets it) but
    // spoofable when self-hosted without a trusted proxy in front.
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!limiter.allow(ip)) {
      return NextResponse.json(
        { error: "Too many messages. Please try again in a minute." },
        { status: 429 }
      );
    }

    // fetch() always sets content-length for string bodies, so a missing or
    // malformed header only comes from hand-rolled clients — reject instead of
    // buffering an unbounded chunked body. (`Number(null)` is 0 and NaN
    // comparisons are false, so a bare `>` check alone waves both through.)
    const declaredBytes = Number(req.headers.get("content-length"));
    if (!Number.isInteger(declaredBytes) || declaredBytes <= 0 || declaredBytes > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "That message is too large to send." },
        { status: 413 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    // Bound lengths server-side — the client maxLength is advisory, the API is
    // directly reachable, so an attacker can post arbitrarily large fields.
    const name = String(body.name ?? "").trim().slice(0, 120);
    const email = String(body.email ?? "").trim().slice(0, 200);
    const message = String(body.message ?? "").trim();
    // Honeypot: real users never fill this hidden field. "topic" is the
    // current field name; "company" is honored for any stale cached client
    // (and was retired because password managers autofill organization-shaped
    // names, silently eating real messages).
    const honeypot = String(body.topic ?? body.company ?? "").trim();

    if (honeypot) {
      // Silently accept to not tip off bots — but leave a trace in the
      // function logs so a false positive is observable, not invisible.
      console.warn("contact: honeypot tripped, message dropped");
      return NextResponse.json({ ok: true });
    }
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Please fill in your name, email, and a message." },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "That email address doesn't look right." },
        { status: 400 }
      );
    }
    if (message.length > 5000) {
      return NextResponse.json(
        { error: "That message is a bit too long." },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("RESEND_API_KEY is not set.");
      return NextResponse.json(
        { error: "Email isn't configured yet. Please email me directly." },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const from =
      process.env.CONTACT_FROM || "Portfolio <onboarding@resend.dev>";
    const to = process.env.CONTACT_TO || profile.email;

    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: email,
      // Strip CR/LF so the user-supplied name can't shape the subject header.
      subject: `Portfolio message from ${name.replace(/[\r\n]+/g, " ")}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `
        <div style="font-family:system-ui,sans-serif;line-height:1.6">
          <h2 style="margin:0 0 8px">New portfolio message</h2>
          <p style="margin:0"><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
          <p style="white-space:pre-wrap;margin:0">${escapeHtml(message)}</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: "Couldn't send your message. Please email me directly." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact route error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please email me directly." },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
