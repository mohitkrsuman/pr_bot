import { Hono } from "hono";
import { validateEnv } from "./env.js";
import crypto from "node:crypto";
import type { PRPayload } from "@pr-bot/types";
import  { createOctokit } from "@pr-bot/github";

export const webhookRoute = new Hono();

webhookRoute.post("/", async (c) => {
  const env = validateEnv();
  const rawBody = await c.req.text();

  const signature = c.req.header("x-hub-signature-256");

  if (!signature) {
    console.warn("[webhook] Missing signature header");
    return c.json({ error: "Missing signature" }, 401);
  }

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", env.GITHUB_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);

  if (
    sigBuffer.length !== expBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expBuffer)
  ) {
    console.warn("[webhook] Invalid signature - possible spoofed request");
    return c.json({ error: "Unauthorized" }, 401);
  }

  // check github event
  const event = c.req.header("x-github-event");
  console.log(`[webhook] Received event: ${event}`);

  if (event !== "pull_request") {
    return c.json({ ok: true, skipped: true, event });
  }

  // parsing payload
  let payload: PRPayload;
  try {
    payload = JSON.parse(rawBody) as PRPayload;
  } catch {
    return c.json({ error: "invalid json body" }, 400);
  }

  // we need to make it act only on opened, synchronize (new commits pushed), and reopened
  const relevantActions = ["opened", "synchronize", "reopened"];

  if (!relevantActions.includes(payload.action)) {
    return c.json({ ok: true, skipped: true, action: payload.action });
  }

  console.log(
    `[webhook] PR #${payload.pull_request.number} ${payload.action} in ${payload.repository.full_name}`,
  );

  setTimeout(() => {
    handlePRAsync(payload).catch((err) => {
      console.error("[webhook] Error handling PR:", err);
    });
  }, 0);

  return c.json({ ok: true, message: "Review queued" });
});

async function handlePRAsync(payload: PRPayload): Promise<void> {
  const env = validateEnv();

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const prNumber = payload.pull_request.number;
  const headSha = payload.pull_request.head.sha;

  console.log(`[pr] Reviewing PR #${prNumber} in ${owner}/${repo}`);

  const octokit = createOctokit(env.GITHUB_TOKEN);

  console.log(
    `[pr-handler] starting review for PR #${payload.pull_request.number}`,
  );

  console.log(`[pr-handler] Head SHA: ${payload.pull_request.head.sha}`);
}
