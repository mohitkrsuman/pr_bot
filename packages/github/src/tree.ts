// this code will fetch complete repo file tree. This gives the context to ai about hte overall project structure

import type { Octokit } from "@octokit/rest";
import type { FileTreeEntry } from "@pr-bot/types";

export async function fetchFileTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
): Promise<FileTreeEntry[]> {
  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: sha,
    recursive: "1",
  });

  if (data.truncated) {
    console.warn("[github] file tree was truncated - repo have too many files");
  }

  return (data.tree as FileTreeEntry[]).filter(
    (entry) => entry.type === "blob" && entry.path !== undefined,
  );
}
