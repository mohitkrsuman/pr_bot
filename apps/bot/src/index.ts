import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => {
   return c.json({ status: "ok", ts: new Date().toISOString() });
});

app.post("/webhook", (c) => {
   return c.json({ ok: true, message: "webhook received" });
});

const port = Number(process.env.PORT) || 8000;

serve({ fetch: app.fetch, port }, () => {
   console.log(`PR Review Bot running on http://localhost:${port}`);
});