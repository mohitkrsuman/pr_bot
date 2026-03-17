import OpenAI from "openai";
import { z } from "zod";
import type { ReviewContext, ReviewResult, ReviewIssue } from "@pr-bot/types";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

const SYSTEM_PROMPT = `You are an expert software engineer tasked with reviewing pull requests.
   
   Your job is to analyze the provided code changes and provide a summary of the changes and a list of issues.
   
   The user will provide you with:
   - A list of files that were changed
   - The git diff of each file
   - The file tree of the repository
   - Existing exports from other files
   - Installed packages
   
   You should respond with a summary of the changes and a list of issues.
   
   For each issue, you must provide:
   - The file where the issue is located
   - The line number
   - The severity (critical, warning, suggestion)
   - The type of issue (security, bug, performance, quality, unnecessary_file, duplicate_code, deprecated_api, vulnerability, license, other)
   - A description of the issue
   - A suggestion for how to fix it

   If there are no issues, return an empty array for issues.`;

// building the user prompt from context

function buildPrompt(ctx: ReviewContext): string {
  const sections: string[] = [];

  sections.push(`## Project Context Repository: ${ctx.repo.onwer}/${ctx.repo.name} PR #${ctx.prNumber}
      
      ### File Tree (summarized)
      ${ctx.fileTree
        .slice(0, 150)
        .map((f) => f.path)
        .join("\n")}
      `);

  sections.push(`### Changed files 
         ${ctx.changedFiles
           .map(
             (
               f,
             ) => `### ${f.filename} (${f.status}, + ${f.additions}/-${f.deletions})\`\`\`diff
               ${f.patch ?? "(no patch)"}\`\`\``,
           )
           .join("\n\n")}
      `);

  if (ctx.existingExports.length > 0) {
    sections.push(
      `### Existing utility exports ${ctx.existingExports.map((e) => `- ${e.file}: ${e.exports.join(",")}`).join("\n")}`,
    );
  }

  if (ctx.installedPackages.length > 0) {
    sections.push(`### Installed packages ${ctx.installedPackages.join(",")}`);
  }

  sections.push(`## Instructions
          Review for: 
          - Security issues
          - Bug fixes
          - Performance improvements
          - Code quality enhancements
          - Unnecessary files
          - Duplicate code
          - Deprecated APIs
          - Vulnerabilities
          - License compliance
          - Other issues

          Return ONLY this JSON:
          {
            "summary": "high-level assessment",
               "issues": [
                   {
                     "file": "relative path",
                     "line": 12,
                     "severity": "critical" | "warning" | "suggestion",
                     "type": "security" | "bug" | "performance" | "quality" | "unnecessary_file" | "duplicate_code" | "deprecated_api" | "vulnerability" | "license" | "other", "message": "what is wrong and why",
                     "suggestion": "how to fix it"
                  }
      ]`);

      return sections.join("\n\n---\n\n");
}

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
    console.log(`[reviewer] Received response, validating schema...`);

    let parsed: unknown;

    try{
        parsed = JSON.parse(rawText);
    }catch{
        console.error("[reviewer] Failed to parse OpenAI response:", rawText);
        return {
            summary: "Review could not be completed - AI returned an unparseable response.",
            issues: [],
        };
    }
   
    const validated = ReviewResultSchema.safeParse(parsed);
    if(!validated.success) {
        console.error("[reviewer] Schema validation failed:", validated.error.errors);
        return {
            summary: "Review completed but response failed schema validation.",
            issues: [],
        }
    }

    console.log(`[reviewer] Found ${validated.data.issues.length} issues`);
    return validated.data as ReviewResult;
}
