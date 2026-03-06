import { z } from "zod";

const EnvSchema = z.object({
  GITHUB_TOKEN: z.string().min(1, "GITHUB_TOKEN is required"),
  GITHUB_WEBHOOK_SECRET: z.string().min(1, "GITHUB_WEBHOOK_SECRET is required"),
  OPEN_AI_KEY: z.string().min(1, "OPEN_AI is required"),
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(): Env{
   const result = EnvSchema.safeParse(process.env);

   if(!result.success){
      console.error("Missing enviroment variables");
      result.error.errors.forEach((e) => {
         console.error(`${e.path[0]}: ${e.message}`);
      });
      process.exit(1);
   }

   return result.data;
}