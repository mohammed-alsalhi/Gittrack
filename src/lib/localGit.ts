import type { LocalGitSummary } from "../types";

export async function loadLocalGitSummary(repoPath: string) {
  const url = new URL("/api/local-git/summary", window.location.origin);
  if (repoPath.trim()) url.searchParams.set("path", repoPath.trim());

  const response = await fetch(url);
  const payload = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to scan local git repository.");
  }

  return payload as LocalGitSummary;
}
