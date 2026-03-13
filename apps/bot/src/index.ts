import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { webhookRoute } from "./webhook.js";

const app = new Hono();

app.get("/health", (c) => {
   return c.json({ status: "ok", ts: new Date().toISOString() });
});

app.route("/webhook", webhookRoute);

const port = Number(process.env.PORT) || 8000;

serve({ fetch: app.fetch, port }, () => {
   console.log(`PR Review Bot running on http://localhost:${port}`);
});