import type { Octokit } from "@octokit/rest";
import type { ChangedFile } from "@pr-bot/types";

const SKIP_PATTERNS = [
  /package-lock\.json$/,
  /pnpm-lock\.yaml$/,
  /yarn\.lock$/,
  /\.snap$/,
  /\.min\.(js|css)$/,
  /dist\//,
  /build\//,
  /\.generated\./,
];

const REVIEWABLE_EXTENSIONS = [
   ".ts", ".tsx", ".js", ".jsx", ".py", ".php"
];

function shouldSkip(filename: string): boolean {
   return SKIP_PATTERNS.some((pattern) => pattern.test(filename));
}

function isReviewable(filename: string): boolean {
   return REVIEWABLE_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

export async function fetchChangedFiles(
   octokit: Octokit,
   owner: string,
   repo: string,
   prNumber: number,
) : Promise<ChangedFile[]> {
   const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
   });

   console.log(`[github] PR has ${files.length} total changed files`);

   const filtered = files.filter(
      (f) => 
         !shouldSkip(f.filename) &&
         isReviewable(f.filename) &&
         f.status !== "removed"
   );

   console.log(`[github] ${filtered.length} files to review after filtering`);

   return filtered.map((f) => ({
      filename: f.filename,
      status: f.status as ChangedFile["status"],
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
   }));

}
