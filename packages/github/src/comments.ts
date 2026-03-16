// will post the summary comment and inline review comments back to the PR.

import type { Octokit } from "@octokit/rest";
import type { ReviewIssue, ReviewResult } from "../../types/dist/index.js";

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  warning: "🟡",
  suggestion: "🔵",
};

export async function postSummaryComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  result: ReviewResult,
): Promise<void> {
  const critical = result.issues.filter(
    (i) => i.severity === "critical",
  ).length;
  const warning = result.issues.filter((i) => i.severity === "warning").length;
  const suggestion = result.issues.filter(
    (i) => i.severity === "suggestion",
  ).length;

  const body = [
    "## 🤖 PR Review Bot",
    "",
    result.summary,
    "",
    "---",
    `🔴 **${critical} critical** · 🟡 **${warning} warnings** · 🔵 **${suggestion} suggestions**`,
  ].join("\n");

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });

  console.log(`[github] posted summary comment to PR #${prNumber}`);
}


export async function postReviewComments(
   octokit: Octokit,
   owner: string,
   repo: string,
   prNumber: number,
   commitSha: string,
   issues: ReviewIssue[],
): Promise<void> {
   let posted = 0;
   let skipped = 0;

   for(const issue of issues) {
      try{
         const emoji = SEVERITY_EMOJI[issue.severity] ?? "💬";
         
         const body = [
            `${emoji} **[${issue.severity.toUpperCase()}] ${issue.type}**`,
            "",
            issue.message,
            "",
            `**Suggestion:** ${issue.suggestion}`
         ].join("\n");

         await octokit.pulls.createReviewComment({
            owner,
            repo,
            pull_number: prNumber,
            commit_id: commitSha,
            path: issue.file,
            line: issue.line,
            body,
         });

         posted++;
      }catch(err){
         console.warn(
            `[github] Skipped comment on ${issue.file}: ${issue.line} - line not in diff`
         );
         skipped++;
      }
   }

   console.log(`[github] posted ${posted} comments to PR #${prNumber} (${skipped} skipped due to line not being in diff)]`)
}