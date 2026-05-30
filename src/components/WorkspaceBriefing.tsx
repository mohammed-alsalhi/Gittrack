import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clipboard,
  GitMerge,
  GitPullRequest,
  RadioTower,
  ShieldCheck,
  Sparkles,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import type {
  BranchSummary,
  PullRequestSummary,
  ReviewDecision,
  ReviewMemoryByPr,
  WorkspaceBriefActionMemoryById,
  WorkspaceBriefActionStatus,
} from "../types";
import { getPrIntelligence, getWorkspacePulse } from "../lib/insights";
import { formatRelativeTime, StatusPill } from "./ui";
import type { WorkspaceLens } from "./WorkspaceLensBar";

interface WorkspaceBriefingProps {
  repo: string;
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  reviewMemory: ReviewMemoryByPr;
  actionMemory: WorkspaceBriefActionMemoryById;
  onSelectPullRequest: (id: string) => void;
  onOpenLens: (lens: WorkspaceLens) => void;
  onSmartMerge: (id: string) => void;
  onPromoteCodex: (id: string) => void;
  onMarkDecision: (id: string, decision: ReviewDecision) => void;
  onUpdateActionStatus: (id: string, status: WorkspaceBriefActionStatus) => void;
  onCopyBrief: (text: string) => void;
}

type BriefTone = "blue" | "green" | "amber" | "red" | "purple";
type BriefActionKind = "unblock" | "merge" | "codex" | "review" | "draft" | "fallback";

interface BriefAction {
  id: string;
  kind: BriefActionKind;
  title: string;
  detail: string;
  impact: string;
  eta: string;
  confidence: number;
  primaryLabel: string;
  lens: WorkspaceLens;
  tone: BriefTone;
  icon: LucideIcon;
  pr?: PullRequestSummary;
}

interface BriefMetric {
  label: string;
  value: string;
  detail: string;
  tone: BriefTone;
}

export function WorkspaceBriefing({
  repo,
  pullRequests,
  branches,
  reviewMemory,
  actionMemory,
  onSelectPullRequest,
  onOpenLens,
  onSmartMerge,
  onPromoteCodex,
  onMarkDecision,
  onUpdateActionStatus,
  onCopyBrief,
}: WorkspaceBriefingProps) {
  const briefing = buildWorkspaceBriefing(repo, pullRequests, branches, reviewMemory);
  const primaryAction = briefing.actions[0];

  const openAction = (action: BriefAction) => {
    if (action.pr) onSelectPullRequest(action.pr.id);
    onOpenLens(action.lens);
  };

  const runPrimaryAction = (action: BriefAction) => {
    if (action.pr) onSelectPullRequest(action.pr.id);
    onOpenLens(action.lens);

    if (action.kind === "merge" && action.pr) {
      onSmartMerge(action.pr.id);
      onUpdateActionStatus(action.id, "queued");
      return;
    }

    if (action.kind === "codex" && action.pr && action.pr.codex.exists) {
      onPromoteCodex(action.pr.id);
      onUpdateActionStatus(action.id, "queued");
      return;
    }

    if (action.kind === "draft" && action.pr) {
      onMarkDecision(action.pr.id, "ready");
      onUpdateActionStatus(action.id, "queued");
      return;
    }

    if (action.kind === "unblock" && action.pr) {
      onMarkDecision(action.pr.id, "blocked");
      onUpdateActionStatus(action.id, "queued");
      return;
    }

    onUpdateActionStatus(action.id, "queued");
  };

  return (
    <section className="workspace-briefing" id="workspace-briefing" data-testid="workspace-briefing">
      <div className="briefing-hero">
        <div className="briefing-title">
          <span>Workspace briefing</span>
          <h2>{briefing.headline}</h2>
          <p>{briefing.summary}</p>
        </div>

        <div className="briefing-command-strip" aria-label="Brief actions">
          <button
            type="button"
            className="briefing-copy"
            onClick={() => onCopyBrief(formatWorkspaceBriefing(briefing))}
            data-testid="workspace-brief-copy"
          >
            <Clipboard size={14} />
            Copy brief
          </button>
          <button
            type="button"
            className="briefing-primary"
            disabled={!primaryAction}
            onClick={() => primaryAction && runPrimaryAction(primaryAction)}
            data-testid="brief-primary-action"
          >
            <Sparkles size={15} />
            {primaryAction?.primaryLabel ?? "No action"}
          </button>
        </div>
      </div>

      <div className="briefing-metrics" aria-label="Operating metrics">
        {briefing.metrics.map((metric) => (
          <div className={`briefing-metric metric-${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </div>
        ))}
      </div>

      <div className="briefing-body">
        <div className="briefing-actions">
          <div className="briefing-section-head">
            <RadioTower size={15} />
            <strong>Next best actions</strong>
            <span>{briefing.actions.length} ranked</span>
          </div>

          <div className="briefing-action-list">
            {briefing.actions.map((action, index) => {
              const Icon = action.icon;
              const status = actionMemory[action.id]?.status ?? "open";

              return (
                <article className={`briefing-action action-${action.tone}`} key={action.id}>
                  <button type="button" className="briefing-action-main" onClick={() => openAction(action)}>
                    <span className="briefing-rank">{index + 1}</span>
                    <span className="briefing-action-icon">
                      <Icon size={16} />
                    </span>
                    <span className="briefing-action-copy">
                      <strong>{action.title}</strong>
                      <small>{action.detail}</small>
                    </span>
                    {action.pr && <StatusPill state={action.pr.state} />}
                  </button>

                  <div className="briefing-action-meta">
                    <span>{action.impact}</span>
                    <span>{action.eta}</span>
                    <span>{action.confidence}% confidence</span>
                    <em className={`action-status status-${status}`}>{status}</em>
                  </div>

                  <div className="briefing-action-buttons">
                    <button type="button" onClick={() => runPrimaryAction(action)}>
                      {action.primaryLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateActionStatus(action.id, status === "done" ? "open" : "done")}
                      data-testid={status === "done" ? "workspace-brief-status-open" : "workspace-brief-status-done"}
                    >
                      {status === "done" ? "Reopen" : "Done"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="briefing-radar">
          <div className="briefing-section-head">
            <ShieldCheck size={15} />
            <strong>Operating radar</strong>
            <span>{briefing.flowScore} flow</span>
          </div>

          <div className="briefing-radar-grid">
            {briefing.radar.map((item) => (
              <button type="button" className={`radar-card radar-${item.tone}`} key={item.label} onClick={() => onOpenLens(item.lens)}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </button>
            ))}
          </div>

          <div className="briefing-timeline">
            <span>Critical path</span>
            {briefing.timeline.map((item) => (
              <button type="button" key={item.id} onClick={() => openAction(item)}>
                <i className={`timeline-pin pin-${item.tone}`} />
                <span>
                  <strong>{item.pr ? `#${item.pr.number}` : item.title}</strong>
                  <small>{item.pr ? `${item.title} - updated ${formatRelativeTime(item.pr.updatedAt)}` : item.detail}</small>
                </span>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function buildWorkspaceBriefing(
  repo: string,
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  reviewMemory: ReviewMemoryByPr,
) {
  const pulse = getWorkspacePulse(pullRequests, branches);
  const open = pullRequests.filter((pr) => pr.state !== "merged");
  const entries = open.map((pr, index) => ({
    pr,
    intel: getPrIntelligence(pr, index),
    memory: reviewMemory[pr.id],
  }));
  const blockers = entries.filter(
    ({ pr, memory }) => memory?.decision === "blocked" || pr.state === "changes_requested" || pr.ci === "failure",
  );
  const ready = entries.filter(
    ({ pr, intel, memory }) =>
      !pr.isDraft &&
      pr.ci === "success" &&
      pr.state !== "changes_requested" &&
      memory?.decision !== "blocked" &&
      (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1),
  );
  const codexPending = entries.filter(({ pr }) => !pr.codex.exists || pr.codex.reaction === "eyes");
  const waiting = entries.filter(({ pr }) => pr.state === "waiting_review");
  const draft = entries.filter(({ pr }) => pr.isDraft && pr.ci === "success");
  const driftedBranches = branches.filter((branch) => branch.health === "behind" || branch.health === "diverged");
  const codexClear = Math.max(0, open.length - codexPending.length);
  const confidence = Math.max(48, Math.min(99, pulse.flowScore - blockers.length * 6 - codexPending.length * 2 + ready.length * 3));
  const topBlocker = sortByPriority(blockers)[0];
  const topReady = sortByPriority(ready)[0];
  const topCodex = sortByPriority(codexPending)[0];
  const topWaiting = sortByPriority(waiting)[0];
  const topDraft = sortByPriority(draft)[0];
  const actions = [
    topBlocker && createBriefAction("unblock", topBlocker.pr, topBlocker.intel, confidence),
    topReady && createBriefAction("merge", topReady.pr, topReady.intel, confidence + 4),
    topCodex && createBriefAction("codex", topCodex.pr, topCodex.intel, confidence - 3),
    topWaiting && createBriefAction("review", topWaiting.pr, topWaiting.intel, confidence - 1),
    topDraft && createBriefAction("draft", topDraft.pr, topDraft.intel, confidence - 4),
  ].filter(Boolean) as BriefAction[];
  const uniqueActions = dedupeActions(actions).slice(0, 4);
  const fallbackAction = createFallbackAction(repo, confidence);
  const finalActions = uniqueActions.length ? uniqueActions : [fallbackAction];
  const headline = topBlocker
    ? `Unblock #${topBlocker.pr.number} before shipping`
    : topReady
      ? `Ship #${topReady.pr.number} next`
      : topCodex
        ? `Clear AI coverage for #${topCodex.pr.number}`
        : `Workspace is in a clean review lane`;
  const summary = `${ready.length} merge-ready, ${blockers.length} blocked, ${codexPending.length} waiting on Codex, ${driftedBranches.length} drifted branches.`;
  const metrics: BriefMetric[] = [
    {
      label: "Merge-ready",
      value: `${ready.length}/${Math.max(1, open.length)}`,
      detail: pulse.queueEstimate,
      tone: ready.length ? "green" : "amber",
    },
    {
      label: "Blockers",
      value: String(blockers.length),
      detail: blockers.length ? "needs attention" : "clear",
      tone: blockers.length ? "red" : "green",
    },
    {
      label: "AI coverage",
      value: `${codexClear}/${Math.max(1, open.length)}`,
      detail: codexPending.length ? `${codexPending.length} pending` : "complete",
      tone: codexPending.length ? "amber" : "green",
    },
    {
      label: "Branch drift",
      value: String(driftedBranches.length),
      detail: branches.length ? `${branches.length} tracked` : "no branches",
      tone: driftedBranches.length ? "amber" : "blue",
    },
  ];
  const radar = [
    {
      label: "Review lane",
      value: String(waiting.length + blockers.length),
      detail: "waiting or blocked",
      tone: blockers.length ? "red" : "amber",
      lens: "focus" as const,
    },
    {
      label: "AI lane",
      value: String(codexPending.length),
      detail: "eyes or missing",
      tone: codexPending.length ? "amber" : "green",
      lens: "ai" as const,
    },
    {
      label: "Ship lane",
      value: String(ready.length),
      detail: "can enter train",
      tone: ready.length ? "green" : "amber",
      lens: "ship" as const,
    },
    {
      label: "Ops lane",
      value: String(driftedBranches.length),
      detail: "branch drift",
      tone: driftedBranches.length ? "amber" : "blue",
      lens: "ops" as const,
    },
  ];

  return {
    repo,
    headline,
    summary,
    confidence,
    flowScore: pulse.flowScore,
    metrics,
    actions: finalActions,
    radar,
    timeline: finalActions.slice(0, 3),
  };
}

function createBriefAction(
  kind: Exclude<BriefActionKind, "fallback">,
  pr: PullRequestSummary,
  intel: ReturnType<typeof getPrIntelligence>,
  confidenceSeed: number,
): BriefAction {
  const confidence = Math.max(42, Math.min(99, confidenceSeed - (intel.risk === "high" ? 7 : intel.risk === "medium" ? 2 : 0)));
  const base = {
    id: `${pr.repo}:${kind}:${pr.id}`,
    pr,
    eta: intel.queueEstimate === "blocked" ? "blocked" : `${intel.queueEstimate} lane`,
    confidence,
  };

  if (kind === "unblock") {
    return {
      ...base,
      kind,
      title: `Unblock #${pr.number}`,
      detail: `${pr.title} has ${pr.ciSummary.toLowerCase()} and is holding the review lane.`,
      impact: "Restores queue health",
      primaryLabel: "Mark blocked",
      lens: "focus",
      tone: "red",
      icon: AlertTriangle,
    };
  }

  if (kind === "merge") {
    return {
      ...base,
      kind,
      title: `Queue #${pr.number} for merge`,
      detail: `${pr.title} is the cleanest ship candidate with ${intel.readiness}/${intel.readinessTotal} readiness.`,
      impact: "Moves release forward",
      primaryLabel: "Queue merge",
      lens: "ship",
      tone: "green",
      icon: GitMerge,
    };
  }

  if (kind === "codex") {
    const hasEyes = pr.codex.exists && pr.codex.reaction === "eyes";

    return {
      ...base,
      kind,
      title: hasEyes ? `Promote Codex signal on #${pr.number}` : `Get Codex coverage on #${pr.number}`,
      detail: hasEyes ? pr.codex.statusText : `${pr.title} has no Codex review signal yet.`,
      impact: "Raises AI confidence",
      primaryLabel: hasEyes ? "Promote signal" : "Open AI lane",
      lens: "ai",
      tone: "purple",
      icon: Bot,
    };
  }

  if (kind === "draft") {
    return {
      ...base,
      kind,
      title: `Turn #${pr.number} into a reviewable slice`,
      detail: `${pr.title} has green CI but is still draft work.`,
      impact: "Creates review throughput",
      primaryLabel: "Mark ready",
      lens: "focus",
      tone: "blue",
      icon: GitPullRequest,
    };
  }

  return {
    ...base,
    kind,
    title: `Pull review forward on #${pr.number}`,
    detail: `${pr.title} is waiting on reviewers and was updated ${formatRelativeTime(pr.updatedAt)}.`,
    impact: "Reduces review load",
    primaryLabel: "Open review",
    lens: "focus",
    tone: "amber",
    icon: TimerReset,
  };
}

function createFallbackAction(repo: string, confidence: number): BriefAction {
  return {
    id: `${repo}:fallback:workspace-clear`,
    kind: "fallback",
    title: "Run a light workspace sweep",
    detail: "No urgent blockers. Skim the inbox, confirm AI coverage, then keep shipping.",
    impact: "Keeps the lane warm",
    eta: "5m lane",
    confidence,
    primaryLabel: "Open inbox",
    lens: "all",
    tone: "blue",
    icon: CheckCircle2,
  };
}

function sortByPriority<T extends { pr: PullRequestSummary; intel: ReturnType<typeof getPrIntelligence> }>(items: T[]) {
  return [...items].sort((a, b) => scoreEntry(b) - scoreEntry(a));
}

function scoreEntry({ pr, intel }: { pr: PullRequestSummary; intel: ReturnType<typeof getPrIntelligence> }) {
  return (
    (pr.ci === "failure" ? 30 : 0) +
    (pr.state === "changes_requested" ? 26 : 0) +
    (pr.state === "approved" ? 18 : 0) +
    (!pr.codex.exists || pr.codex.reaction === "eyes" ? 14 : 0) +
    (intel.risk === "high" ? 18 : intel.risk === "medium" ? 8 : 3) +
    intel.readiness
  );
}

function dedupeActions(actions: BriefAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = action.pr?.id ?? action.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatWorkspaceBriefing(briefing: ReturnType<typeof buildWorkspaceBriefing>) {
  return [
    `Workspace briefing: ${briefing.repo}`,
    briefing.headline,
    briefing.summary,
    "",
    "Next best actions:",
    ...briefing.actions.map((action, index) => `${index + 1}. ${action.title} - ${action.detail}`),
    "",
    "Operating metrics:",
    ...briefing.metrics.map((metric) => `- ${metric.label}: ${metric.value} (${metric.detail})`),
  ].join("\n");
}
