import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { createRateLimiter } from "../lib/rateLimit";

// --- Pure limiter contract (direct import, injected clock — no sleeps) ------

test("limiter allows up to max within one window and blocks the rest", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
  const start = 1_000;
  for (let call = 0; call < 5; call += 1) {
    expect(limiter.allow("ip", start + call)).toBe(true);
  }
  expect(limiter.allow("ip", start + 5)).toBe(false);
  expect(limiter.allow("ip", start + 6)).toBe(false);
});

test("limiter tracks keys independently", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
  expect(limiter.allow("first", 0)).toBe(true);
  expect(limiter.allow("first", 1)).toBe(false);
  expect(limiter.allow("second", 2)).toBe(true);
});

test("limiter resets a key once its window expires", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
  for (let call = 0; call < 6; call += 1) {
    limiter.allow("ip", call);
  }
  // The boundary instant still belongs to the old window...
  expect(limiter.allow("ip", 60_000)).toBe(false);
  // ...one millisecond later the window has expired and the count resets.
  expect(limiter.allow("ip", 60_001)).toBe(true);
});

test("limiter prunes expired windows instead of clobbering live state", () => {
  const limiter = createRateLimiter({ windowMs: 1_000, max: 1, maxEntries: 2 });
  expect(limiter.allow("stale-a", 0)).toBe(true);
  expect(limiter.allow("stale-b", 0)).toBe(true);
  // Both stale keys have expired by now; new keys must reuse the pruned
  // slots, so a freshly blocked key keeps its state even at the cap.
  expect(limiter.allow("live", 2_000)).toBe(true);
  expect(limiter.allow("live", 2_000)).toBe(false);
  expect(limiter.allow("newcomer", 2_000)).toBe(true);
  expect(limiter.allow("live", 2_000)).toBe(false);
});

test("limiter caps tracked keys by evicting the oldest window under churn", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1, maxEntries: 2 });
  expect(limiter.allow("a", 0)).toBe(true);
  expect(limiter.allow("b", 1)).toBe(true);
  expect(limiter.allow("a", 2)).toBe(false);
  // A third live key hits the cap and evicts "a", the oldest window...
  expect(limiter.allow("c", 3)).toBe(true);
  // ...so "a" comes back as a fresh key: memory stays bounded at the cost of
  // forgetting the oldest limiter state.
  expect(limiter.allow("a", 4)).toBe(true);
});

// --- Contact route behavior (request fixture against baseURL) ---------------

// The route keys its rate limit on the first x-forwarded-for entry, so every
// test posts under a throwaway key: parallel workers never share a bucket.
const uniqueIp = () => `test-${randomUUID()}`;

const validMessage = {
  name: "Playwright Probe",
  email: "probe@example.com",
  message: "Checking the contact route's guardrails.",
};

const contact = (
  request: APIRequestContext,
  data: Record<string, unknown>,
  ip: string
) => request.post("/api/contact", { headers: { "x-forwarded-for": ip }, data });

test("contact rejects malformed JSON with a 400", async ({ request }) => {
  const response = await request.post("/api/contact", {
    headers: {
      "x-forwarded-for": uniqueIp(),
      "content-type": "application/json",
    },
    // A Buffer goes over the wire untouched; a string here would be
    // re-serialized by Playwright into valid JSON and dodge the parse error.
    data: Buffer.from("{not json"),
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: "Invalid request." });
});

test("contact rejects missing fields with a 400 and a generic message", async ({
  request,
}) => {
  const response = await contact(
    request,
    { name: "", email: "", message: "" },
    uniqueIp()
  );
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({
    error: "Please fill in your name, email, and a message.",
  });
});

test("contact rejects a malformed email with a 400", async ({ request }) => {
  const response = await contact(
    request,
    { ...validMessage, email: "not-an-email" },
    uniqueIp()
  );
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({
    error: "That email address doesn't look right.",
  });
});

test("contact rejects an over-long message with a 400", async ({ request }) => {
  const response = await contact(
    request,
    { ...validMessage, message: "x".repeat(5_001) },
    uniqueIp()
  );
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({
    error: "That message is a bit too long.",
  });
});

test("contact silently accepts a honeypot submission", async ({ request }) => {
  const response = await contact(
    request,
    { ...validMessage, company: "Totally Real Inc" },
    uniqueIp()
  );
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test("contact rate limits the sixth request from one address", async ({
  request,
}) => {
  const ip = uniqueIp();
  // Honeypot bodies keep the flood inert: the limiter runs before any other
  // handling, and nothing is ever sent for these.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const accepted = await contact(
      request,
      { ...validMessage, company: "bot" },
      ip
    );
    expect(accepted.status()).toBe(200);
  }
  const blocked = await contact(request, { ...validMessage, company: "bot" }, ip);
  expect(blocked.status()).toBe(429);
  expect(await blocked.json()).toEqual({
    error: "Too many messages. Please try again in a minute.",
  });
});

test("contact rejects an oversized payload with a 413 before parsing", async ({
  request,
}) => {
  const response = await contact(
    request,
    { ...validMessage, message: "x".repeat(40_000) },
    uniqueIp()
  );
  expect(response.status()).toBe(413);
  expect(await response.json()).toEqual({
    error: "That message is too large to send.",
  });
});

test("contact fails closed with a generic 500 when email isn't configured", async ({
  request,
}) => {
  // The Playwright web server starts without RESEND_API_KEY, so a fully valid
  // submission exercises the missing-configuration branch. A 200 or 502 here
  // means the test environment has a real key wired in — nothing is asserted
  // against secrets, only the generic user-facing message.
  const response = await contact(request, validMessage, uniqueIp());
  expect(response.status()).toBe(500);
  expect(await response.json()).toEqual({
    error: "Email isn't configured yet. Please email me directly.",
  });
});
