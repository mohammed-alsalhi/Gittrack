import type { BranchSummary, PullRequestSummary, ReviewMemory } from "../types";

export interface PullRequestActionState {
  branchKnown: boolean;
  branchClean: boolean;
  codexReady: boolean;
  locallyReady: boolean;
  hasReadySignal: boolean;
  canPromoteCodex: boolean;
  canMarkReady: boolean;
  canQueueMerge: boolean;
  blockedReason?: string;
}

export function findBranchForPullRequest(
  branches: BranchSummary[],
  pr: PullRequestSummary,
) {
  return branches.find(
    (branch) =>
      branch.repo === pr.repo &&
      (branch.pullRequestNumber === pr.number || branch.name === pr.branch),
  );
}

export function getPullRequestActionState(
  pr: PullRequestSummary,
  branch?: BranchSummary,
  memory?: ReviewMemory,
): PullRequestActionState {
  const branchKnown = Boolean(branch);
  const branchClean = branch ? branch.health !== "diverged" && branch.behind === 0 : false;
  const codexReady =
    pr.codex.reaction === "changed" ||
    pr.codex.reaction === "thumbs_up" ||
    Boolean(memory?.checklist.checked_codex);
  const locallyReady = memory?.decision === "ready";
  const hasReadySignal = pr.state === "approved" || codexReady || locallyReady;
  const blockedReason = firstBlockedReason(pr, branch, branchKnown, branchClean, hasReadySignal);

  return {
    branchKnown,
    branchClean,
    codexReady,
    locallyReady,
    hasReadySignal,
    canPromoteCodex: pr.state !== "merged" && !codexReady,
    canMarkReady: !blockedReason && !locallyReady,
    canQueueMerge: !blockedReason && hasReadySignal,
    blockedReason,
  };
}

function firstBlockedReason(
  pr: PullRequestSummary,
  branch: BranchSummary | undefined,
  branchKnown: boolean,
  branchClean: boolean,
  hasReadySignal: boolean,
) {
  if (pr.state === "merged") return "Already merged.";
  if (pr.isDraft || pr.state === "draft") return "Draft pull requests cannot be queued.";
  if (pr.state === "changes_requested") return "Changes are requested.";
  if (pr.ci === "failure") return "CI is failing.";
  if (pr.ci === "pending") return "CI is still running.";
  if (pr.ci !== "success") return "CI status is unknown.";
  if (!branchKnown) return "Branch drift is unknown.";
  if (!branchClean) {
    if (branch?.health === "diverged") return "Branch is diverged from base.";
    if ((branch?.behind ?? 0) > 0) return "Branch is behind base.";
    return "Branch is not clean.";
  }
  if (!hasReadySignal) return "Needs approval, Codex signal, or local ready decision.";
  return undefined;
}
