import OpenAI from "openai";
import { z } from "zod";
import type { ReviewContext } from "@pr-bot/types";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ReviewResult = z.infer<typeof ReviewResultSchema>;

/**
 * Zod Schemas (single source of truth)
 */
const ReviewIssueSchema = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  severity: z.enum(["critical", "warning", "suggestion"]),
  type: z.enum([
    "security",
    "bug",
    "performance",
    "quality",
    "unnecessary_file",
    "duplicate_code",
    "deprecated_api",
    "vulnerability",
    "license",
    "other",
  ]),
  message: z.string(),
  suggestion: z.string(),
});

const ReviewResultSchema = z.object({
  summary: z.string(),
  issues: z.array(ReviewIssueSchema),
});

/**
 * System Prompt
 */
const SYSTEM_PROMPT = `You are an expert software engineer reviewing pull requests.

Return ONLY valid JSON in this exact format:

{
  "summary": "string",
  "issues": [
    {
      "file": "string",
      "line": number,
      "severity": "critical" | "warning" | "suggestion",
      "type": "security" | "bug" | "performance" | "quality" | "unnecessary_file" | "duplicate_code" | "deprecated_api" | "vulnerability" | "license" | "other",
      "message": "string",
      "suggestion": "string"
    }
  ]
}

IMPORTANT:
- Do not return markdown
- Do not add explanations
- Only return JSON
- Always use "deprecated_api" (correct spelling)
`;

/**
 * Build prompt
 */
function buildPrompt(ctx: ReviewContext): string {
  const sections: string[] = [];

  sections.push(`## Project Context
Repository: ${ctx.repo.owner}/${ctx.repo.name}
PR #${ctx.prNumber}

### File Tree
${ctx.fileTree.slice(0, 150).map(f => f.path).join("\n")}
`);

  sections.push(`### Changed Files
${ctx.changedFiles.map(f => `
### ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})
\`\`\`diff
${f.patch ?? "(no patch)"}
\`\`\`
`).join("\n")}
`);

  if (ctx.existingExports.length > 0) {
    sections.push(`### Existing Exports
${ctx.existingExports.map(e => `- ${e.file}: ${e.exports.join(", ")}`).join("\n")}
`);
  }

  if (ctx.installedPackages.length > 0) {
    sections.push(`### Installed Packages
${ctx.installedPackages.join(", ")}
`);
  }

  return sections.join("\n\n---\n\n");
}

/**
 * Normalize AI mistakes (important)
 */
function normalizeIssues(data: any) {
  if (!data?.issues) return data;

  for (const issue of data.issues) {
    if (issue.type === "depreceated_api") {
      issue.type = "deprecated_api";
    }
  }

  return data;
}

/**
 * Main review function
 */
export async function runReview(ctx: ReviewContext): Promise<ReviewResult> {
  console.log(`[reviewer] Sending ${ctx.changedFiles.length} files to OPENAI`);

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildPrompt(ctx) },
    ],
    response_format: { type: "json_object" },
  });

  const rawText = response.choices[0]?.message?.content ?? "";
  console.log(`[reviewer] Received response`);

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    console.error("[reviewer] Failed to parse:", rawText);
    return {
      summary: "AI returned invalid JSON",
      issues: [],
    };
  }

  // ✅ fix AI mistakes before validation
  const normalized = normalizeIssues(parsed);

  const validated = ReviewResultSchema.safeParse(normalized);

  if (!validated.success) {
    console.error("[reviewer] Schema validation failed:", validated.error.errors);
    return {
      summary: "Schema validation failed",
      issues: [],
    };
  }

  console.log(`[reviewer] Found ${validated.data.issues.length} issues`);

  return validated.data;
}