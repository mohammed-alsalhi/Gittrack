import {
  CheckCircle2,
  Database,
  GitBranch,
  GitPullRequest,
  Radar,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { getPrIntelligence } from "../lib/insights";
import type { BranchSummary, PullRequestSummary, RepoSummary, ReviewMemoryByPr } from "../types";
import { formatRelativeTime } from "./ui";

interface RepoScopePopoverProps {
  open: boolean;
  repos: RepoSummary[];
  activeRepo: string;
  source: "sample" | "github";
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  reviewMemory: ReviewMemoryByPr;
  onClose: () => void;
  onSelectRepo: (repo: string) => void;
  onOpenSettings: () => void;
  onOpenConnectionCenter: () => void;
}

interface RepoScopeModel {
  repo: RepoSummary;
  activePrs: number;
  branchCount: number;
  drift: number;
  blockers: number;
  ready: number;
  aiGaps: number;
  latestAt?: string;
  score: number;
}

export function RepoScopePopover({
  open,
  repos,
  activeRepo,
  source,
  pullRequests,
  branches,
  reviewMemory,
  onClose,
  onSelectRepo,
  onOpenSettings,
  onOpenConnectionCenter,
}: RepoScopePopoverProps) {
  if (!open) return null;

  const models = buildRepoScopes(repos, pullRequests, branches, reviewMemory);
  const totals = models.reduce(
    (total, model) => ({
      activePrs: total.activePrs + model.activePrs,
      blockers: total.blockers + model.blockers,
      drift: total.drift + model.drift,
      aiGaps: total.aiGaps + model.aiGaps,
    }),
    { activePrs: 0, blockers: 0, drift: 0, aiGaps: 0 },
  );

  return (
    <aside className="repo-scope-popover" data-testid="repo-scope-popover" role="dialog" aria-label="Repository scope switcher">
      <div className="repo-scope-head">
        <div>
          <span>Repository scope</span>
          <h2>{repos.length} synced repos</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close repository scope" data-testid="repo-scope-close">
          <X size={14} />
        </button>
      </div>

      <div className="repo-scope-summary" aria-label="Repository scope metrics">
        <RepoScopeMetric icon={<GitPullRequest size={14} />} label="Open PRs" value={totals.activePrs} tone="blue" />
        <RepoScopeMetric icon={<ShieldAlert size={14} />} label="Blockers" value={totals.blockers} tone={totals.blockers ? "red" : "green"} />
        <RepoScopeMetric icon={<GitBranch size={14} />} label="Drift" value={totals.drift} tone={totals.drift ? "amber" : "green"} />
        <RepoScopeMetric icon={<Sparkles size={14} />} label="AI gaps" value={totals.aiGaps} tone={totals.aiGaps ? "purple" : "green"} />
      </div>

      <div className="repo-scope-list">
        {models.map((model) => (
          <button
            type="button"
            className={`repo-scope-card ${model.repo.slug === activeRepo ? "active" : ""}`}
            key={model.repo.slug}
            onClick={() => onSelectRepo(model.repo.slug)}
            data-testid={`repo-scope-row-${model.repo.slug}`}
          >
            <span className="repo-scope-card-icon">
              <GitBranch size={15} />
            </span>
            <span className="repo-scope-card-copy">
              <strong>{model.repo.slug}</strong>
              <small>
                {model.latestAt ? `Updated ${formatRelativeTime(model.latestAt)}` : `${model.repo.defaultBranch} default branch`}
              </small>
            </span>
            <span className="repo-scope-card-metrics">
              <em>{model.activePrs} PRs</em>
              <em className={model.blockers ? "risk" : ""}>{model.blockers} blockers</em>
              <em>{model.ready} ready</em>
            </span>
          </button>
        ))}
      </div>

      <div className="repo-scope-footer">
        <div>
          <Database size={14} />
          <span>{source === "github" ? "Live GitHub sync" : "Sample workspace"}</span>
        </div>
        <button type="button" onClick={onOpenConnectionCenter}>
          <Radar size={14} />
          Cockpit
        </button>
        <button type="button" onClick={onOpenSettings}>
          <Settings size={14} />
          Settings
        </button>
      </div>
    </aside>
  );
}

function RepoScopeMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "blue" | "green" | "amber" | "red" | "purple";
}) {
  return (
    <div className={`repo-scope-metric metric-${tone}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildRepoScopes(
  repos: RepoSummary[],
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  reviewMemory: ReviewMemoryByPr,
) {
  return repos
    .map<RepoScopeModel>((repo) => {
      const repoPrs = pullRequests.filter((pr) => pr.repo === repo.slug && pr.state !== "merged");
      const repoBranches = branches.filter((branch) => branch.repo === repo.slug);
      const drift = repoBranches.filter((branch) => branch.name !== repo.defaultBranch && branch.health !== "healthy").length;
      const blockers = repoPrs.filter(
        (pr) => pr.ci === "failure" || pr.state === "changes_requested" || reviewMemory[pr.id]?.decision === "blocked",
      ).length;
      const ready = repoPrs.filter((pr, index) => {
        const intel = getPrIntelligence(pr, index);
        return intel.readiness >= intel.readinessTotal - 1 && pr.ci === "success" && !pr.isDraft && reviewMemory[pr.id]?.decision !== "blocked";
      }).length;
      const aiGaps = repoPrs.filter((pr) => !pr.codex.exists).length;
      const latestAt =
        [...repoPrs.map((pr) => pr.updatedAt), ...repoBranches.map((branch) => branch.updatedAt)]
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

      return {
        repo,
        activePrs: repoPrs.length,
        branchCount: repoBranches.length,
        drift,
        blockers,
        ready,
        aiGaps,
        latestAt,
        score: blockers * 20 + aiGaps * 8 + drift * 7 + repoPrs.length * 3 + ready,
      };
    })
    .sort((a, b) => b.score - a.score || b.activePrs - a.activePrs || a.repo.slug.localeCompare(b.repo.slug));
}
