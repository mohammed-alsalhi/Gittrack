import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clipboard,
  GitBranch,
  GitPullRequest,
  Layers3,
  Radar,
  Route,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import type { BranchSummary, PullRequestSummary, RepoSummary, ReviewMemoryByPr } from "../types";
import { CiBadge, CodexBadge, formatRelativeTime, StatusPill } from "./ui";

type PortfolioTone = "green" | "amber" | "red" | "blue" | "purple";
type PortfolioActionKind = "open" | "radar" | "batch";

interface PortfolioPulseDeckProps {
  repos: RepoSummary[];
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  reviewMemory: ReviewMemoryByPr;
  activeRepo: string;
  onSelectRepo: (repo: string) => void;
  onOpenPullRequest: (repo: string, id: string) => void;
  onOpenChangeRadar: () => void;
  onOpenBatchCart: () => void;
  onCopyPortfolioBrief: (text: string, count: number) => void;
}

interface RepoPulse {
  repo: RepoSummary;
  active: PullRequestSummary[];
  ready: PullRequestSummary[];
  blockers: PullRequestSummary[];
  aiGaps: PullRequestSummary[];
  drift: BranchSummary[];
  priorityPrs: PullRequestSummary[];
  actions: PortfolioAction[];
  score: number;
  tone: PortfolioTone;
  queueEstimate: string;
  detail: string;
}

interface PortfolioAction {
  id: string;
  label: string;
  detail: string;
  kind: PortfolioActionKind;
  tone: PortfolioTone;
  icon: LucideIcon;
  pullRequest?: PullRequestSummary;
}

interface PortfolioMetric {
  label: string;
  value: string;
  detail: string;
  tone: PortfolioTone;
  icon: LucideIcon;
}

export function PortfolioPulseDeck({
  repos,
  pullRequests,
  branches,
  reviewMemory,
  activeRepo,
  onSelectRepo,
  onOpenPullRequest,
  onOpenChangeRadar,
  onOpenBatchCart,
  onCopyPortfolioBrief,
}: PortfolioPulseDeckProps) {
  const model = useMemo(
    () => buildPortfolioPulse(repos, pullRequests, branches, reviewMemory),
    [branches, pullRequests, repos, reviewMemory],
  );
  const selectedRepo = model.repos.find((item) => item.repo.slug === activeRepo) ?? model.repos[0];
  const selectedActions = selectedRepo?.actions ?? [];
  const selectedPrs = selectedRepo?.priorityPrs.slice(0, 4) ?? [];

  return (
    <section className="portfolio-pulse-deck" data-testid="portfolio-pulse-deck" aria-label="Portfolio pulse">
      <div className="portfolio-pulse-head">
        <div>
          <span>Portfolio pulse</span>
          <h2>{model.headline}</h2>
        </div>
        <div className="portfolio-pulse-actions">
          <button
            type="button"
            onClick={() => onCopyPortfolioBrief(model.copy, model.totals.active)}
            data-testid="portfolio-copy-brief"
          >
            <Clipboard size={14} />
            Copy brief
          </button>
          <button type="button" onClick={onOpenChangeRadar}>
            <Radar size={14} />
            Radar
          </button>
          <button type="button" onClick={onOpenBatchCart}>
            <Route size={14} />
            Batch
          </button>
        </div>
      </div>

      <div className="portfolio-pulse-metrics" aria-label="Portfolio metrics">
        {model.metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <div className={`portfolio-metric metric-${metric.tone}`} key={metric.label}>
              <Icon size={15} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          );
        })}
      </div>

      <div className="portfolio-pulse-grid">
        <div className="portfolio-repo-column">
          <div className="portfolio-section-title">
            <span>Repos</span>
            <strong>{model.repos.length}</strong>
          </div>

          <div className="portfolio-repo-list">
            {model.repos.map((item) => (
              <button
                type="button"
                className={`portfolio-repo-card repo-${item.tone} ${item.repo.slug === activeRepo ? "active" : ""}`}
                key={item.repo.slug}
                onClick={() => onSelectRepo(item.repo.slug)}
              >
                <span className="portfolio-score">{item.score}</span>
                <span className="portfolio-repo-copy">
                  <strong>{item.repo.slug}</strong>
                  <small>{item.detail}</small>
                </span>
                <span className="portfolio-repo-counters" aria-label={`${item.active.length} active pull requests`}>
                  <em>{item.active.length} PRs</em>
                  <em>{item.drift.length} drift</em>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="portfolio-focus-column">
          <div className="portfolio-section-title">
            <span>{selectedRepo?.repo.slug ?? "No repo"} operating lane</span>
            <strong>{selectedRepo?.score ?? 0}</strong>
          </div>

          {selectedRepo ? (
            <>
              <div className={`portfolio-focus-card repo-${selectedRepo.tone}`}>
                <div>
                  <span className="portfolio-focus-icon">
                    {iconForRepoPulse(selectedRepo)}
                  </span>
                  <span>
                    <strong>{headlineForRepo(selectedRepo)}</strong>
                    <small>{selectedRepo.queueEstimate} queue at current pressure</small>
                  </span>
                </div>
                <div className="portfolio-focus-ratios" aria-label="Repo ratios">
                  <RatioCell label="Ready" value={selectedRepo.ready.length} tone="green" />
                  <RatioCell label="Block" value={selectedRepo.blockers.length} tone="red" />
                  <RatioCell label="AI" value={selectedRepo.aiGaps.length} tone="purple" />
                  <RatioCell label="Drift" value={selectedRepo.drift.length} tone="amber" />
                </div>
              </div>

              <div className="portfolio-pr-list">
                {selectedPrs.map((pr) => (
                  <button
                    type="button"
                    className="portfolio-pr-row"
                    key={pr.id}
                    onClick={() => onOpenPullRequest(pr.repo, pr.id)}
                  >
                    <span className="portfolio-pr-number">#{pr.number}</span>
                    <span className="portfolio-pr-copy">
                      <strong>{pr.title}</strong>
                      <small>{pr.branch} - {formatRelativeTime(pr.updatedAt)}</small>
                    </span>
                    <span className="portfolio-pr-badges">
                      <StatusPill state={pr.state} />
                      <CiBadge state={pr.ci} />
                      <CodexBadge reaction={pr.codex.reaction} compact />
                    </span>
                  </button>
                ))}

                {!selectedPrs.length && (
                  <div className="portfolio-empty">
                    <CheckCircle2 size={18} />
                    <strong>No active PRs</strong>
                    <span>This repo is quiet. Pick another repo or refresh GitHub.</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="portfolio-empty">
              <Layers3 size={18} />
              <strong>No repositories</strong>
              <span>Connect GitHub or use sample data to populate the portfolio.</span>
            </div>
          )}
        </div>

        <aside className="portfolio-action-column">
          <div className="portfolio-section-title">
            <span>Next actions</span>
            <strong>{selectedActions.length}</strong>
          </div>

          <div className="portfolio-action-list">
            {selectedActions.map((action) => {
              const Icon = action.icon;

              return (
                <article className={`portfolio-action-card action-${action.tone}`} key={action.id}>
                  <span className="portfolio-action-icon">
                    <Icon size={15} />
                  </span>
                  <div>
                    <strong>{action.label}</strong>
                    <p>{action.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runPortfolioAction(action, {
                      onOpenPullRequest,
                      onOpenChangeRadar,
                      onOpenBatchCart,
                    })}
                  >
                    {labelForAction(action.kind)}
                    <ArrowRight size={13} />
                  </button>
                </article>
              );
            })}

            {!selectedActions.length && (
              <div className="portfolio-empty compact">
                <CheckCircle2 size={18} />
                <strong>All quiet</strong>
                <span>No portfolio actions are waiting.</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function RatioCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: PortfolioTone;
}) {
  return (
    <span className={`portfolio-ratio ratio-${tone}`}>
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}

function buildPortfolioPulse(
  repos: RepoSummary[],
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  reviewMemory: ReviewMemoryByPr,
) {
  const repoModels = repos
    .map((repo) => buildRepoPulse(repo, pullRequests, branches, reviewMemory))
    .sort((a, b) => b.blockers.length - a.blockers.length || b.aiGaps.length - a.aiGaps.length || b.ready.length - a.ready.length);
  const totals = repoModels.reduce(
    (sum, repo) => ({
      active: sum.active + repo.active.length,
      ready: sum.ready + repo.ready.length,
      blockers: sum.blockers + repo.blockers.length,
      aiGaps: sum.aiGaps + repo.aiGaps.length,
      drift: sum.drift + repo.drift.length,
    }),
    { active: 0, ready: 0, blockers: 0, aiGaps: 0, drift: 0 },
  );
  const flowScore = clamp(96 + totals.ready * 2 - totals.blockers * 12 - totals.aiGaps * 4 - totals.drift * 5, 28, 99);
  const headline = totals.blockers
    ? `${totals.blockers} blocker ${plural("lane", totals.blockers)} across ${repos.length} repos`
    : totals.ready
      ? `${totals.ready} PR ${plural("slot", totals.ready)} ready across the portfolio`
      : `${repos.length} repos are steady`;
  const metrics: PortfolioMetric[] = [
    {
      label: "Flow",
      value: String(flowScore),
      detail: "portfolio score",
      tone: flowScore >= 86 ? "green" : flowScore >= 68 ? "amber" : "red",
      icon: Layers3,
    },
    {
      label: "Ready",
      value: String(totals.ready),
      detail: `${totals.active} active PRs`,
      tone: totals.ready ? "green" : "blue",
      icon: CheckCircle2,
    },
    {
      label: "Blockers",
      value: String(totals.blockers),
      detail: "CI, review, risk",
      tone: totals.blockers ? "red" : "green",
      icon: ShieldAlert,
    },
    {
      label: "AI gaps",
      value: String(totals.aiGaps),
      detail: "missing or eyes",
      tone: totals.aiGaps ? "purple" : "green",
      icon: Bot,
    },
    {
      label: "Drift",
      value: String(totals.drift),
      detail: "sync needed",
      tone: totals.drift ? "amber" : "green",
      icon: GitBranch,
    },
  ];

  return {
    copy: formatPortfolioBrief(repoModels, totals, flowScore),
    headline,
    metrics,
    repos: repoModels,
    totals,
  };
}

function buildRepoPulse(
  repo: RepoSummary,
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  reviewMemory: ReviewMemoryByPr,
): RepoPulse {
  const active = pullRequests.filter((pr) => pr.repo === repo.slug && pr.state !== "merged");
  const repoBranches = branches.filter((branch) => branch.repo === repo.slug);
  const blockers = active.filter((pr) => isBlocked(pr, reviewMemory));
  const ready = active.filter((pr, index) => isReady(pr, reviewMemory, index));
  const aiGaps = active.filter((pr) => !pr.codex.exists || pr.codex.reaction === "eyes");
  const drift = repoBranches.filter((branch) => branch.name !== repo.defaultBranch && isBranchDrifted(branch));
  const priorityPrs = uniquePullRequests([...blockers, ...aiGaps, ...ready, ...active]);
  const score = clamp(94 + ready.length * 4 - blockers.length * 18 - aiGaps.length * 6 - drift.length * 7, 22, 99);
  const tone: PortfolioTone = blockers.length ? "red" : drift.length ? "amber" : aiGaps.length ? "purple" : ready.length ? "green" : "blue";
  const queueMinutes = Math.max(4, active.length * 3 + blockers.length * 8 + aiGaps.length * 3 + drift.length * 4 - ready.length * 2);

  return {
    active,
    actions: buildRepoActions(repo, blockers, aiGaps, ready, drift),
    aiGaps,
    blockers,
    detail: `${ready.length} ready, ${blockers.length} blocked, ${aiGaps.length} AI gaps`,
    drift,
    priorityPrs,
    queueEstimate: `${queueMinutes}m`,
    ready,
    repo,
    score,
    tone,
  };
}

function buildRepoActions(
  repo: RepoSummary,
  blockers: PullRequestSummary[],
  aiGaps: PullRequestSummary[],
  ready: PullRequestSummary[],
  drift: BranchSummary[],
): PortfolioAction[] {
  const actions: PortfolioAction[] = [];
  const blocker = blockers[0];
  const aiGap = aiGaps.find((pr) => pr.codex.reaction === "eyes") ?? aiGaps[0];
  const readyPr = ready[0];

  if (blocker) {
    actions.push({
      id: `${repo.slug}:blocker:${blocker.id}`,
      label: `Unblock #${blocker.number}`,
      detail: blocker.ci === "failure" ? "CI is failing. Open the PR and repair the stack lane." : "Review risk is holding this repo back.",
      icon: AlertTriangle,
      kind: "open",
      pullRequest: blocker,
      tone: "red",
    });
  }

  if (aiGap) {
    actions.push({
      id: `${repo.slug}:ai:${aiGap.id}`,
      label: `Close AI gap on #${aiGap.number}`,
      detail: aiGap.codex.exists ? "Codex is still at eyes; verify or promote it." : "No Codex review is attached yet.",
      icon: Bot,
      kind: "open",
      pullRequest: aiGap,
      tone: "purple",
    });
  }

  if (drift[0]) {
    actions.push({
      id: `${repo.slug}:drift:${drift[0].id}`,
      label: "Inspect branch drift",
      detail: `${drift.length} ${plural("branch", drift.length)} need a sync or rebase before reviews stay valid.`,
      icon: GitBranch,
      kind: "radar",
      tone: "amber",
    });
  }

  if (readyPr) {
    actions.push({
      id: `${repo.slug}:ready:${readyPr.id}`,
      label: `Stage #${readyPr.number}`,
      detail: "This PR is close enough to load into the merge queue.",
      icon: GitPullRequest,
      kind: "batch",
      pullRequest: readyPr,
      tone: "green",
    });
  }

  return actions.slice(0, 4);
}

function isBlocked(pr: PullRequestSummary, reviewMemory: ReviewMemoryByPr) {
  const memory = reviewMemory[pr.id];
  const intel = getPrIntelligence(pr);
  return pr.ci === "failure" || pr.state === "changes_requested" || memory?.decision === "blocked" || intel.risk === "high";
}

function isReady(pr: PullRequestSummary, reviewMemory: ReviewMemoryByPr, index: number) {
  const memory = reviewMemory[pr.id];
  const intel = getPrIntelligence(pr, index);
  return (
    !pr.isDraft &&
    pr.ci === "success" &&
    memory?.decision !== "blocked" &&
    (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1)
  );
}

function isBranchDrifted(branch: BranchSummary) {
  return branch.behind > 0 || branch.health === "behind" || branch.health === "diverged" || branch.health === "stale";
}

function uniquePullRequests(pullRequests: PullRequestSummary[]) {
  const seen = new Set<string>();
  return pullRequests.filter((pr) => {
    if (seen.has(pr.id)) return false;
    seen.add(pr.id);
    return true;
  });
}

function iconForRepoPulse(repo: RepoPulse) {
  if (repo.blockers.length) return <AlertTriangle size={15} />;
  if (repo.drift.length) return <GitBranch size={15} />;
  if (repo.aiGaps.length) return <Bot size={15} />;
  return <CheckCircle2 size={15} />;
}

function headlineForRepo(repo: RepoPulse) {
  if (repo.blockers.length) return `${repo.repo.slug} needs unblock work`;
  if (repo.drift.length) return `${repo.repo.slug} has branch drift`;
  if (repo.aiGaps.length) return `${repo.repo.slug} needs AI review coverage`;
  if (repo.ready.length) return `${repo.repo.slug} has merge-ready work`;
  return `${repo.repo.slug} is quiet`;
}

function runPortfolioAction(
  action: PortfolioAction,
  handlers: Pick<PortfolioPulseDeckProps, "onOpenPullRequest" | "onOpenChangeRadar" | "onOpenBatchCart">,
) {
  if (action.kind === "open" && action.pullRequest) {
    handlers.onOpenPullRequest(action.pullRequest.repo, action.pullRequest.id);
    return;
  }

  if (action.kind === "radar") {
    handlers.onOpenChangeRadar();
    return;
  }

  handlers.onOpenBatchCart();
}

function labelForAction(kind: PortfolioActionKind) {
  if (kind === "open") return "Open";
  if (kind === "radar") return "Radar";
  return "Batch";
}

function formatPortfolioBrief(repoModels: RepoPulse[], totals: { active: number; ready: number; blockers: number; aiGaps: number; drift: number }, flowScore: number) {
  const lines = [
    "Portfolio pulse",
    `Flow score: ${flowScore}`,
    `${totals.active} active PRs, ${totals.ready} ready, ${totals.blockers} blockers, ${totals.aiGaps} AI gaps, ${totals.drift} drifted branches.`,
    "",
    ...repoModels.map((repo) => (
      `${repo.repo.slug}: score ${repo.score} - ${repo.ready.length} ready, ${repo.blockers.length} blocked, ${repo.aiGaps.length} AI gaps, ${repo.drift.length} drift, ${repo.queueEstimate} queue`
    )),
  ];

  return lines.join("\n");
}

function plural(label: string, count: number) {
  if (count === 1) return label;
  if (label === "branch") return "branches";
  return `${label}s`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
