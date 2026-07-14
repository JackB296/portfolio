import { NextResponse } from "next/server";
import { Resend } from "resend";
import { profile } from "@/lib/data";

export const runtime = "nodejs";

// Basic in-memory rate limit (per warm serverless instance) to deter spam.
const hits = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.ts > WINDOW_MS) {
    hits.set(ip, { count: 1, ts: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many messages — please try again in a minute." },
        { status: 429 }
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
    // Honeypot: real users never fill this hidden field.
    const company = String(body.company ?? "").trim();

    if (company) {
      // Silently accept to not tip off bots.
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
    .replace(/"/g, "&quot;");
}
