import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Copy,
  GitBranchPlus,
  GitMerge,
  GitPullRequestCreate,
  ListFilter,
  MoreHorizontal,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  Sparkles,
  TerminalSquare,
  X,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { BranchSummary, PullRequestSummary, ReviewMemoryByPr } from "../types";
import { getPrIntelligence, getWorkspacePulse } from "../lib/insights";

interface CommandCenterProps {
  activeRepo: string;
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  reviewMemory: ReviewMemoryByPr;
  onOpenCommandPalette: () => void;
  onRefresh: () => void;
  onOpenPullRequest: (id: string) => void;
  onPromoteCodex: (id: string) => void;
  onSmartMerge: (id: string) => void;
  onOpenBranchDrift: () => void;
  onOpenMergeQueue: () => void;
  onOpenStackReview: () => void;
  onCopyCommandDraft: (label: string, text: string) => void;
  onStageCommandDraft: (label: string) => void;
}

type CommandTone = "green" | "amber" | "red" | "blue" | "purple";
type QuickActionId = "create_stack" | "new_branch" | "sync" | "rebase" | "merge_queue";

interface CommandQueueItem {
  id: string;
  icon: LucideIcon;
  label: string;
  title: string;
  detail: string;
  actionLabel: string;
  tone: CommandTone;
  run: () => void;
}

interface QuickActionDraft {
  id: QuickActionId;
  icon: LucideIcon;
  label: string;
  title: string;
  detail: string;
  tone: CommandTone;
  primaryLabel: string;
  commandLines: string[];
  checks: Array<{ label: string; value: string; ready: boolean }>;
  metrics: Array<{ label: string; value: string }>;
  run: () => void;
}

export function CommandCenter({
  activeRepo,
  pullRequests,
  branches,
  reviewMemory,
  onOpenCommandPalette,
  onRefresh,
  onOpenPullRequest,
  onPromoteCodex,
  onSmartMerge,
  onOpenBranchDrift,
  onOpenMergeQueue,
  onOpenStackReview,
  onCopyCommandDraft,
  onStageCommandDraft,
}: CommandCenterProps) {
  const [activeActionId, setActiveActionId] = useState<QuickActionId | null>(null);
  const pulse = getWorkspacePulse(pullRequests, branches);
  const commandQueue = buildCommandQueue({
    branches,
    onOpenBranchDrift,
    onOpenMergeQueue,
    onOpenPullRequest,
    onOpenStackReview,
    onPromoteCodex,
    onSmartMerge,
    pullRequests,
    reviewMemory,
  });
  const quickActions = useMemo(
    () => buildQuickActions({ activeRepo, branches, onOpenBranchDrift, onOpenCommandPalette, onOpenMergeQueue, onOpenStackReview, onRefresh, pullRequests, reviewMemory }),
    [activeRepo, branches, onOpenBranchDrift, onOpenCommandPalette, onOpenMergeQueue, onOpenStackReview, onRefresh, pullRequests, reviewMemory],
  );
  const activeDraft = quickActions.find((action) => action.id === activeActionId) ?? null;

  return (
    <section className="command-center">
      <div className="command-main">
        <div>
          <span className="workspace-label">PR inbox</span>
          <h1>{activeRepo}</h1>
        </div>

        <button className="command-search" onClick={onOpenCommandPalette}>
          <Search size={16} />
          <span>Type a command or search PRs...</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      <div className="quick-actions" aria-label="Quick actions">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              className={activeActionId === action.id ? "active" : ""}
              data-testid={`quick-action-${action.id}`}
              key={action.id}
              onClick={() => setActiveActionId((current) => (current === action.id ? null : action.id))}
            >
              <Icon size={15} />
              <span>{action.label}</span>
              {action.id === "create_stack" && <kbd>C</kbd>}
              {action.id === "new_branch" && <kbd>B</kbd>}
              {action.id === "sync" && <kbd>S</kbd>}
            </button>
          );
        })}
        <button onClick={onOpenCommandPalette} aria-label="More commands">
          <MoreHorizontal size={15} />
        </button>
      </div>

      {activeDraft && (
        <aside className={`quick-command-composer composer-${activeDraft.tone}`} data-testid="quick-command-composer" aria-label="Quick command composer">
          <div className="quick-composer-head">
            <span className="quick-composer-icon">
              <activeDraft.icon size={15} />
            </span>
            <div>
              <span>{activeDraft.label}</span>
              <strong>{activeDraft.title}</strong>
            </div>
            <button type="button" onClick={() => setActiveActionId(null)} aria-label="Close quick command composer" data-testid="quick-command-close">
              <X size={14} />
            </button>
          </div>

          <p>{activeDraft.detail}</p>

          <div className="quick-composer-metrics" aria-label="Command draft metrics">
            {activeDraft.metrics.map((metric) => (
              <span key={metric.label}>
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
              </span>
            ))}
          </div>

          <div className="quick-composer-body">
            <div className="quick-composer-command">
              <div>
                <TerminalSquare size={14} />
                <span>Command draft</span>
              </div>
              <pre>{activeDraft.commandLines.join("\n")}</pre>
            </div>

            <div className="quick-composer-checks">
              {activeDraft.checks.map((check) => (
                <span className={check.ready ? "ready" : "waiting"} key={check.label}>
                  <CheckCircle2 size={13} />
                  <strong>{check.label}</strong>
                  <small>{check.value}</small>
                </span>
              ))}
            </div>
          </div>

          <div className="quick-composer-actions">
            <button
              type="button"
              onClick={() => onCopyCommandDraft(activeDraft.label, activeDraft.commandLines.join("\n"))}
              data-testid="quick-command-copy"
            >
              <Copy size={14} />
              Copy commands
            </button>
            <button
              type="button"
              className="quick-composer-primary"
              onClick={() => {
                activeDraft.run();
                onStageCommandDraft(activeDraft.label);
              }}
              data-testid="quick-command-run"
            >
              <Sparkles size={14} />
              {activeDraft.primaryLabel}
            </button>
          </div>
        </aside>
      )}

      <details className="workspace-pulse-details">
        <summary>
          <span>Workspace pulse</span>
          <strong>
            {pulse.flowScore} flow · {pulse.mergeReady}/{pulse.mergeTotal} ready · {commandQueue.length} suggested moves
          </strong>
          <em>Show</em>
        </summary>

        <div className="smart-command-queue" data-testid="smart-command-queue" aria-label="Smart command queue">
          <div className="smart-command-grid">
            {commandQueue.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  type="button"
                  className={`smart-command-card command-${item.tone}`}
                  key={item.id}
                  onClick={item.run}
                  data-testid={`smart-command-${item.id}`}
                >
                  <span className="smart-command-icon">
                    <Icon size={14} />
                  </span>
                  <span className="smart-command-copy">
                    <small>{item.label}</small>
                    <strong>{item.title}</strong>
                    <em>{item.detail}</em>
                  </span>
                  <b>{item.actionLabel}</b>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pulse-grid" aria-label="Workspace pulse">
          <PulseCard label="Flow score" value={String(pulse.flowScore)} delta="+12 this week" tone="violet" />
          <PulseCard
            label="Merge readiness"
            value={`${pulse.mergeReady} / ${pulse.mergeTotal}`}
            delta="ready with checks"
            tone="green"
            progress={pulse.mergeReady / pulse.mergeTotal}
          />
          <PulseCard label="Stack depth" value={String(pulse.stackDepth)} delta="on main" tone="slate" />
          <PulseCard label="Queue estimate" value={pulse.queueEstimate} delta="at current velocity" tone="amber" />
          <PulseCard label="Review load" value={pulse.reviewLoad} delta="-30% vs last week" tone="green" />
          <PulseCard label="PRs merged" value={String(pulse.mergedCount)} delta="+20% vs last week" tone="green" />
        </div>
      </details>
    </section>
  );
}

function buildQuickActions({
  activeRepo,
  branches,
  pullRequests,
  reviewMemory,
  onOpenBranchDrift,
  onOpenCommandPalette,
  onOpenMergeQueue,
  onOpenStackReview,
  onRefresh,
}: {
  activeRepo: string;
  branches: BranchSummary[];
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  onOpenBranchDrift: () => void;
  onOpenCommandPalette: () => void;
  onOpenMergeQueue: () => void;
  onOpenStackReview: () => void;
  onRefresh: () => void;
}): QuickActionDraft[] {
  const active = pullRequests.filter((pr) => pr.state !== "merged");
  const repoName = activeRepo.split("/").pop() || "repo";
  const draftBranch = `${repoName}-next-stack`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const driftBranches = branches.filter((branch) => branch.health === "behind" || branch.health === "diverged" || branch.health === "stale");
  const ready = active.filter((pr, index) => {
    const intel = getPrIntelligence(pr, index);
    const memory = reviewMemory[pr.id];
    const codexReady = pr.codex.reaction === "thumbs_up" || pr.codex.reaction === "changed";
    return !pr.isDraft && pr.ci === "success" && codexReady && memory?.decision !== "blocked" && (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1);
  });
  const codexGaps = active.filter((pr) => !pr.codex.exists || pr.codex.reaction === "eyes");
  const blockers = active.filter((pr, index) => {
    const intel = getPrIntelligence(pr, index);
    return pr.ci === "failure" || pr.state === "changes_requested" || intel.risk === "high" || reviewMemory[pr.id]?.decision === "blocked";
  });
  const nextReady = ready[0];
  const firstDrift = driftBranches[0];

  return [
    {
      id: "create_stack",
      icon: GitPullRequestCreate,
      label: "Create stack",
      title: `Create review stack in ${activeRepo}`,
      detail: "Prepare a stacked branch lane with the current review context and Codex gates attached.",
      tone: "blue",
      primaryLabel: "Open stack review",
      commandLines: [
        `gt stack create --repo ${activeRepo} --name review-intelligence`,
        `git checkout -b mo/review-intelligence-stack`,
        "gh pr create --draft --fill --label stacked",
      ],
      checks: [
        { label: "Active PRs", value: `${active.length} in scope`, ready: active.length > 0 },
        { label: "AI gaps", value: `${codexGaps.length} pending`, ready: codexGaps.length === 0 },
        { label: "Blockers", value: `${blockers.length} blocking`, ready: blockers.length === 0 },
      ],
      metrics: [
        { label: "PRs", value: String(active.length) },
        { label: "Gaps", value: String(codexGaps.length) },
        { label: "Risk", value: blockers.length ? "High" : "Low" },
      ],
      run: onOpenStackReview,
    },
    {
      id: "new_branch",
      icon: GitBranchPlus,
      label: "New branch",
      title: `Branch from ${activeRepo}`,
      detail: "Draft the next branch with the repo prefix and a review-safe naming pattern.",
      tone: "purple",
      primaryLabel: "Open palette",
      commandLines: [
        "git fetch origin",
        `git checkout -b mo/${draftBranch} origin/main`,
        "git push -u origin HEAD",
      ],
      checks: [
        { label: "Default base", value: "origin/main", ready: true },
        { label: "Prefix", value: "mo/", ready: true },
        { label: "Workspace", value: activeRepo, ready: Boolean(activeRepo) },
      ],
      metrics: [
        { label: "Base", value: "main" },
        { label: "Prefix", value: "mo/" },
        { label: "Repo", value: activeRepo.split("/").pop() || activeRepo },
      ],
      run: onOpenCommandPalette,
    },
    {
      id: "sync",
      icon: RefreshCw,
      label: "Sync",
      title: firstDrift ? `Sync ${firstDrift.name}` : `Sync ${activeRepo}`,
      detail: firstDrift ? "Replay the most stale branch before review work continues." : "Refresh repository state and keep local memory aligned.",
      tone: firstDrift ? "amber" : "green",
      primaryLabel: "Run refresh",
      commandLines: firstDrift
        ? ["git fetch origin", `git checkout ${firstDrift.name}`, "git rebase origin/main", "git push --force-with-lease"]
        : ["git fetch origin", "gh pr list --state open", "gt sync --with-review-memory"],
      checks: [
        { label: "Drift", value: `${driftBranches.length} branches`, ready: driftBranches.length === 0 },
        { label: "Live source", value: "sample-safe", ready: true },
        { label: "Review memory", value: "preserved", ready: true },
      ],
      metrics: [
        { label: "Drift", value: String(driftBranches.length) },
        { label: "Ahead", value: String(firstDrift?.ahead ?? 0) },
        { label: "Behind", value: String(firstDrift?.behind ?? 0) },
      ],
      run: onRefresh,
    },
    {
      id: "rebase",
      icon: Route,
      label: "Rebase stack",
      title: driftBranches.length ? `${driftBranches.length} branches need replay` : "Stack is fresh",
      detail: "Open the branch drift board with a preflight for stale or diverged stack branches.",
      tone: driftBranches.length ? "amber" : "green",
      primaryLabel: "Open drift board",
      commandLines: [
        "git fetch origin",
        ...(firstDrift ? [`git checkout ${firstDrift.name}`, "git rebase origin/main"] : ["git status --short"]),
        "gt stack restack --verify",
      ],
      checks: [
        { label: "Diverged", value: `${branches.filter((branch) => branch.health === "diverged").length} branches`, ready: !branches.some((branch) => branch.health === "diverged") },
        { label: "Behind", value: `${branches.reduce((sum, branch) => sum + branch.behind, 0)} commits`, ready: branches.every((branch) => branch.behind === 0) },
        { label: "Linked PRs", value: `${branches.filter((branch) => branch.pullRequestNumber).length} mapped`, ready: true },
      ],
      metrics: [
        { label: "Drift", value: String(driftBranches.length) },
        { label: "Branches", value: String(branches.length) },
        { label: "Target", value: "main" },
      ],
      run: onOpenBranchDrift,
    },
    {
      id: "merge_queue",
      icon: GitMerge,
      label: "Merge queue",
      title: nextReady ? `Queue #${nextReady.number}` : "Inspect merge train",
      detail: nextReady ? "A green PR is ready to enter the train with Codex and CI gates satisfied." : "Review train gates and unblock the next departure.",
      tone: ready.length ? "green" : "amber",
      primaryLabel: "Open train",
      commandLines: nextReady
        ? [`gh pr merge ${nextReady.number} --queue`, `gt train watch --repo ${activeRepo}`, "gt notify --when-merged"]
        : ["gt train inspect --blockers", "gt review gates --repo current", "gt train plan --next"],
      checks: [
        { label: "Ready", value: `${ready.length} candidates`, ready: ready.length > 0 },
        { label: "CI", value: `${active.filter((pr) => pr.ci === "failure").length} failing`, ready: active.every((pr) => pr.ci !== "failure") },
        { label: "Codex", value: `${codexGaps.length} gaps`, ready: codexGaps.length === 0 },
      ],
      metrics: [
        { label: "Ready", value: String(ready.length) },
        { label: "Blockers", value: String(blockers.length) },
        { label: "ETA", value: nextReady?.queueEstimate ?? "TBD" },
      ],
      run: onOpenMergeQueue,
    },
  ];
}

function buildCommandQueue({
  branches,
  pullRequests,
  reviewMemory,
  onOpenPullRequest,
  onPromoteCodex,
  onSmartMerge,
  onOpenBranchDrift,
  onOpenMergeQueue,
  onOpenStackReview,
}: {
  branches: BranchSummary[];
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  onOpenPullRequest: (id: string) => void;
  onPromoteCodex: (id: string) => void;
  onSmartMerge: (id: string) => void;
  onOpenBranchDrift: () => void;
  onOpenMergeQueue: () => void;
  onOpenStackReview: () => void;
}): CommandQueueItem[] {
  const active = pullRequests.filter((pr) => pr.state !== "merged");
  const blocker = active.find((pr, index) => {
    const intel = getPrIntelligence(pr, index);
    return pr.ci === "failure" || pr.state === "changes_requested" || intel.risk === "high" || reviewMemory[pr.id]?.decision === "blocked";
  });
  const aiGap = active.find((pr) => !pr.codex.exists || pr.codex.reaction === "eyes");
  const ready = active.find((pr, index) => {
    const intel = getPrIntelligence(pr, index);
    const memory = reviewMemory[pr.id];
    const codexReady = pr.codex.reaction === "thumbs_up" || pr.codex.reaction === "changed";
    return (
      !pr.isDraft &&
      pr.ci === "success" &&
      codexReady &&
      memory?.decision !== "blocked" &&
      (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1)
    );
  });
  const drift = branches.find((branch) => branch.health === "behind" || branch.health === "diverged" || branch.health === "stale");
  const commands: CommandQueueItem[] = [];

  if (blocker) {
    const intel = getPrIntelligence(blocker);
    commands.push({
      id: "blocker",
      icon: ShieldAlert,
      label: "Blocker",
      title: `#${blocker.number} needs attention`,
      detail: blocker.ci === "failure" ? blocker.ciSummary : `${intel.risk} risk · ${blocker.state.replace("_", " ")}`,
      actionLabel: "Open",
      tone: "red",
      run: () => onOpenPullRequest(blocker.id),
    });
  }

  if (aiGap) {
    commands.push({
      id: "ai-gap",
      icon: Bot,
      label: "AI review",
      title: `#${aiGap.number} Codex gap`,
      detail: aiGap.codex.exists ? aiGap.codex.statusText : "No Codex review yet",
      actionLabel: "Promote",
      tone: "purple",
      run: () => onPromoteCodex(aiGap.id),
    });
  }

  if (ready) {
    const intel = getPrIntelligence(ready);
    commands.push({
      id: "ship-ready",
      icon: GitMerge,
      label: "Ship",
      title: `#${ready.number} can join train`,
      detail: `${intel.readiness}/${intel.readinessTotal} gates · ${ready.queueEstimate ?? "queue ready"}`,
      actionLabel: "Merge",
      tone: "green",
      run: () => onSmartMerge(ready.id),
    });
  }

  if (drift) {
    commands.push({
      id: "branch-drift",
      icon: AlertTriangle,
      label: "Branch drift",
      title: drift.name,
      detail: `+${drift.ahead} / -${drift.behind} · ${drift.health}`,
      actionLabel: "Sync",
      tone: drift.health === "diverged" ? "red" : "amber",
      run: onOpenBranchDrift,
    });
  }

  commands.push({
    id: "stack-review",
    icon: Sparkles,
    label: "Stack mode",
    title: active.length ? "Review stack order" : "Stack graph clear",
    detail: active.length ? `${active.length} active PRs across stack lanes` : "No open work in this repo",
    actionLabel: "Plan",
    tone: "blue",
    run: onOpenStackReview,
  });

  if (!ready) {
    commands.push({
      id: "merge-train",
      icon: CheckCircle2,
      label: "Merge train",
      title: "Inspect train gates",
      detail: "Forecast queue state and blockers",
      actionLabel: "Open",
      tone: "green",
      run: onOpenMergeQueue,
    });
  }

  return commands.slice(0, 4);
}

function PulseCard({
  label,
  value,
  delta,
  tone,
  progress,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "violet" | "green" | "amber" | "slate";
  progress?: number;
}) {
  return (
    <article className={`pulse-card pulse-${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{delta}</small>
      </div>
      {progress === undefined ? (
        <ListFilter size={18} />
      ) : (
        <span className="pulse-progress" style={{ "--progress": `${Math.round(progress * 100)}%` } as CSSProperties} />
      )}
    </article>
  );
}
