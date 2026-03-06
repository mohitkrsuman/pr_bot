export type Severity = "critical" | "warning" | "suggestion";
export type IssueType = "security" | "bug" | "performance" | "quality" | "unnecessary_fie" | "duplicate_code" | "deprecated_api" | "vulnerability" | "license" | "other";

export interface ReviewIssue {
   file: string;
   line: number;
   severity: Severity;
   type: IssueType;
   message: string;
   suggestion: string;
}

export interface ReviewResult{
   summary: string;
   issues: ReviewIssue[];
}

export interface ChangedFile {
   filename: string;
   status: "added" | "modified" | "removed" | "deleted" | "renamed";
   additions: number;
   deletions: number;
   patch?: string;
}

export interface FileTreeEntry{
   path: string;
   type: "file" | "directory" | "blob"; 
}

export interface FileIndex {
   file: string;
   exports: string[];
}

export interface PRPayload {
   action: "opened" | "synchronize" | "closed" | "reopened";
   number: number;
   pull_request: {
      number: number;
      title: string;
      head: { sha: string; ref: string; repo: { full_name: string } };
      base: { sha: string; ref: string; repo: { full_name: string } };
   };
   repository: {
      owner: { login: string };
      name: string;
      full_name: string;
      default_branch: string;
   }
}

export interface ReviewContext {
   repo: { onwer: string; name: string; default_branch: string };
   prNumber: number;
   changedFiles: ChangedFile[];
   fileTree: FileTreeEntry[];
   existingExports: FileIndex[];
   installedPackages: string[];
}