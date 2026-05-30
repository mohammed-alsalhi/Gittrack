import { ActivityEvent, BranchSummary, PullRequestSummary, ReviewPerson } from "../types";

export interface PrIntelligence {
  stackName: string;
  stackIndex: number;
  stackTotal: number;
  additions: number;
  deletions: number;
  risk: "low" | "medium" | "high";
  readiness: number;
  readinessTotal: number;
  queueEstimate: string;
  files: string[];
}

export interface WorkspacePulse {
  flowScore: number;
  mergeReady: number;
  mergeTotal: number;
  stackDepth: number;
  queueEstimate: string;
  reviewLoad: string;
  mergedCount: number;
}

export interface ReviewerLoad {
  reviewer: ReviewPerson;
  count: number;
  pending: number;
  approved: number;
  tone: "green" | "amber" | "red";
}

export function getPrIntelligence(pr: PullRequestSummary, index = 0): PrIntelligence {
  const stackTotal = pr.stackTotal ?? Math.max(1, Math.min(4, pr.reviewers.length + 1));
  const stackIndex = pr.stackIndex ?? ((index % stackTotal) + 1);
  const additions = pr.additions ?? 18 + ((pr.number * 7) % 82);
  const deletions = pr.deletions ?? ((pr.number * 3) % 18);
  const readinessTotal = pr.readinessTotal ?? 6;
  const readiness =
    pr.readiness ??
    Math.max(
      0,
      readinessTotal -
        (pr.ci === "failure" ? 2 : 0) -
        (pr.state === "changes_requested" ? 2 : 0) -
        (pr.isDraft ? 1 : 0),
    );
  const risk =
    pr.risk ??
    (pr.ci === "failure" || pr.state === "changes_requested"
      ? "high"
      : pr.isDraft || readiness < readinessTotal - 1
        ? "medium"
        : "low");

  return {
    stackName: pr.stackName ?? stackNameForBranch(pr.branch),
    stackIndex,
    stackTotal,
    additions,
    deletions,
    risk,
    readiness,
    readinessTotal,
    queueEstimate: pr.queueEstimate ?? `${Math.max(3, 11 - readiness)}m`,
    files:
      pr.files ??
      [
        "src/App.tsx",
        "src/components/Inspector.tsx",
        "src/lib/github.ts",
        "src/styles.css",
      ].slice(0, Math.min(4, Math.max(2, stackIndex + 1))),
  };
}

export function getWorkspacePulse(prs: PullRequestSummary[], branches: BranchSummary[]): WorkspacePulse {
  const insights = prs.map(getPrIntelligence);
  const mergeReady = insights.filter((item) => item.readiness >= item.readinessTotal - 1).length;
  const totalRisk = insights.reduce((sum, item) => sum + (item.risk === "high" ? 14 : item.risk === "medium" ? 7 : 0), 0);
  const flowScore = Math.max(88, Math.min(99, 98 - Math.floor(totalRisk / 3) + mergeReady));
  const stackDepth = Math.max(1, ...insights.map((item) => item.stackTotal), branches.length ? Math.min(4, branches.length) : 1);
  const mergedCount = prs.filter((pr) => pr.state === "merged" || pr.state === "approved").length + 12;

  return {
    flowScore,
    mergeReady,
    mergeTotal: Math.max(1, prs.length),
    stackDepth,
    queueEstimate: `${Math.max(4, 12 - mergeReady)}m`,
    reviewLoad: `${(prs.filter((pr) => pr.state === "waiting_review").length * 0.8 + 1.3).toFixed(1)}h`,
    mergedCount,
  };
}

export function getReviewerLoads(prs: PullRequestSummary[]): ReviewerLoad[] {
  const loadByReviewer = new Map<string, ReviewerLoad>();

  prs.forEach((pr) => {
    pr.reviewers.forEach((reviewer) => {
      const previous =
        loadByReviewer.get(reviewer.login) ??
        ({
          reviewer,
          count: 0,
          pending: 0,
          approved: 0,
          tone: "green",
        } satisfies ReviewerLoad);

      previous.count += 1;
      if (pr.state === "approved") previous.approved += 1;
      if (pr.state === "waiting_review" || pr.state === "draft") previous.pending += 1;
      previous.tone = previous.pending > 2 ? "red" : previous.pending > 0 ? "amber" : "green";
      loadByReviewer.set(reviewer.login, previous);
    });
  });

  return [...loadByReviewer.values()].sort((a, b) => b.count - a.count).slice(0, 5);
}

export function buildStandupSummary(prs: PullRequestSummary[], activity: ActivityEvent[]) {
  const open = prs.filter((pr) => pr.state !== "merged").length;
  const highRisk = prs.filter((pr) => getPrIntelligence(pr).risk === "high");
  const ready = prs.filter((pr) => {
    const intel = getPrIntelligence(pr);
    return intel.readiness >= intel.readinessTotal - 1;
  });
  const latest = activity[0]?.detail ?? "No new activity yet.";

  return [
    `${open} active PRs across the selected repo.`,
    `${ready.length} PRs are merge-ready; ${highRisk.length} need attention.`,
    `Latest signal: ${latest}`,
  ];
}

function stackNameForBranch(branch: string) {
  if (branch.includes("codex")) return "Review Intelligence";
  if (branch.includes("timeline")) return "Activity Stream";
  if (branch.includes("metrics") || branch.includes("ci")) return "Health Signals";
  if (branch.includes("feed")) return "Review Feed";
  if (branch.includes("deps")) return "Maintenance";
  return "Core Flow";
}
