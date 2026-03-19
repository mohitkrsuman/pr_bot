import OpenAI from "openai";
import type { ReviewContext, ReviewResult } from "@pr-bot/types";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

  const normalized = normalizeIssues(parsed) as ReviewResult;

  console.log(`[reviewer] Found ${normalized.issues.length} issues`);

  return normalized;
}