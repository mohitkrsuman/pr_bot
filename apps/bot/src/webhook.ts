import { Hono } from "hono";
import { validateEnv } from "./env.js";
import crypto from "node:crypto";
import type { PRPayload } from "@pr-bot/types";

export const webhookRoute = new Hono();

webhookRoute.post("/", async (c) => {
   const env = validateEnv();
   const rawBody = await c.req.text();

   const signature = c.req.header('x-hub-signature-256');

   if(!signature){
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

   if(
      sigBuffer.length !== expBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expBuffer)
   ){
      console.warn("[webhook] Invalid signature - possible spoofed request");
      return c.json({ error: "Unauthorized" }, 401);
   }

   // check github event
   const event = c.req.header("x-github-event");
   console.log(`[webhook] Received event: ${event}`);

   if(event !== "pull_request"){
      return c.json({  ok: true, skipped: true, event});
   }
   
   // parsing payload
   let payload: PRPayload;
       
});