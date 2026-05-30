import { useMemo } from "react";
import {
  Bot,
  CheckCircle2,
  Clipboard,
  GitMerge,
  GitPullRequest,
  MessageSquareText,
  RadioTower,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  TimerReset,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import type {
  AutopilotPlaybookId,
  AutopilotPlaybookMemory,
  PullRequestSummary,
  RepoSummary,
  ReviewMemoryByPr,
  ReviewThreadMemoryById,
} from "../types";
import { CiBadge, CodexBadge, formatRelativeTime, StatusPill } from "./ui";

interface AutopilotPlaybookCenterProps {
  repos: RepoSummary[];
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  reviewThreads: ReviewThreadMemoryById;
  memory: AutopilotPlaybookMemory;
  onSelectPlaybook: (id: AutopilotPlaybookId) => void;
  onRunPlaybook: (id: AutopilotPlaybookId, stepIds: string[]) => void;
  onToggleStep: (stepId: string) => void;
  onCopyPlaybook: (text: string, stepCount: number) => void;
  onOpenStackNavigator: () => void;
  onOpenThreadResolver: () => void;
  onOpenBatchCart: () => void;
  onOpenDailyDigest: () => void;
  onOpenDecisionSimulator: () => void;
  onOpenTriageBoard: () => void;
  onPromoteCodex: (id: string) => void;
  onMarkReady: (id: string) => void;
}

interface PlaybookConfig {
  id: AutopilotPlaybookId;
  label: string;
  detail: string;
  icon: LucideIcon;
  tone: PlaybookTone;
}

interface PlaybookStep {
  id: string;
  title: string;
  detail: string;
  target: string;
  metric: string;
  tone: PlaybookTone;
  icon: LucideIcon;
  action: () => void;
}

interface PlaybookSignals {
  activePrs: PullRequestSummary[];
  blocked: PullRequestSummary[];
  ready: PullRequestSummary[];
  aiGaps: PullRequestSummary[];
  reviewWait: PullRequestSummary[];
  unresolvedThreads: number;
  repoCount: number;
  stackCount: number;
}

type PlaybookTone = "blue" | "green" | "amber" | "red" | "purple";

const playbooks: PlaybookConfig[] = [
  {
    id: "morning_review",
    label: "Morning review",
    detail: "Own comments, blockers, stacks, and digest in one pass.",
    icon: RadioTower,
    tone: "blue",
  },
  {
    id: "pre_merge",
    label: "Pre-merge train",
    detail: "Turn green work into a staged queue with blast-radius checks.",
    icon: GitMerge,
    tone: "green",
  },
  {
    id: "ai_sweep",
    label: "AI sweep",
    detail: "Close Codex gaps, eyes-only signals, and stale AI evidence.",
    icon: Bot,
    tone: "purple",
  },
  {
    id: "release_handoff",
    label: "Release handoff",
    detail: "Package decisions into digest and outbound updates.",
    icon: Send,
    tone: "amber",
  },
];

export function AutopilotPlaybookCenter({
  repos,
  pullRequests,
  reviewMemory,
  reviewThreads,
  memory,
  onSelectPlaybook,
  onRunPlaybook,
  onToggleStep,
  onCopyPlaybook,
  onOpenStackNavigator,
  onOpenThreadResolver,
  onOpenBatchCart,
  onOpenDailyDigest,
  onOpenDecisionSimulator,
  onOpenTriageBoard,
  onPromoteCodex,
  onMarkReady,
}: AutopilotPlaybookCenterProps) {
  const signals = useMemo(() => buildSignals(repos, pullRequests, reviewMemory, reviewThreads), [
    pullRequests,
    repos,
    reviewMemory,
    reviewThreads,
  ]);
  const activePlaybook = playbooks.find((playbook) => playbook.id === memory.activePlaybookId) ?? playbooks[0];
  const steps = buildPlaybookSteps(activePlaybook.id, signals, {
    onOpenStackNavigator,
    onOpenThreadResolver,
    onOpenBatchCart,
    onOpenDailyDigest,
    onOpenDecisionSimulator,
    onOpenTriageBoard,
    onPromoteCodex,
    onMarkReady,
  });
  const completedSet = new Set(memory.completedStepIds);
  const completed = steps.filter((step) => completedSet.has(step.id)).length;
  const nextStep = steps.find((step) => !completedSet.has(step.id)) ?? steps[0];
  const runbookText = formatRunbook(activePlaybook, steps, signals, memory.completedStepIds);
  const completion = steps.length ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <section className="playbook-center" id="autopilot-playbook-center" data-testid="autopilot-playbook-center">
      <div className="playbook-head">
        <div>
          <span>Autopilot playbook center</span>
          <h2>{activePlaybook.label}: {completion}% complete</h2>
          <p>Run repeatable operating routines across stacks, review threads, batch commands, AI coverage, and handoff updates.</p>
        </div>
        <div className="playbook-actions">
          <button type="button" onClick={() => onCopyPlaybook(runbookText, steps.length)} data-testid="playbook-copy">
            <Clipboard size={14} />
            Copy runbook
          </button>
          <button type="button" onClick={() => nextStep?.action()} disabled={!nextStep} data-testid="playbook-next">
            <Sparkles size={14} />
            {nextStep ? "Open next" : "No steps"}
          </button>
          <button type="button" onClick={() => onRunPlaybook(activePlaybook.id, steps.map((step) => step.id))} data-testid="playbook-run">
            <CheckCircle2 size={14} />
            Run playbook
          </button>
        </div>
      </div>

      <div className="playbook-metrics" aria-label="Playbook metrics">
        <PlaybookMetric label="Open PRs" value={signals.activePrs.length} detail={`${signals.repoCount} repos`} tone="blue" icon={GitPullRequest} />
        <PlaybookMetric label="Blockers" value={signals.blocked.length} detail={`${signals.unresolvedThreads} threads`} tone={signals.blocked.length ? "red" : "green"} icon={ShieldAlert} />
        <PlaybookMetric label="AI gaps" value={signals.aiGaps.length} detail="Codex lane" tone={signals.aiGaps.length ? "purple" : "green"} icon={Bot} />
        <PlaybookMetric label="Ship-ready" value={signals.ready.length} detail={`${signals.stackCount} stacks`} tone={signals.ready.length ? "green" : "amber"} icon={GitMerge} />
      </div>

      <div className="playbook-body">
        <aside className="playbook-list" aria-label="Playbooks">
          <div className="playbook-section-title">
            <Workflow size={15} />
            <strong>Routines</strong>
            <span>{playbooks.length}</span>
          </div>
          <div className="playbook-tabs" role="tablist" aria-label="Autopilot playbooks">
            {playbooks.map((playbook) => {
              const Icon = playbook.icon;
              const selected = playbook.id === activePlaybook.id;

              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={selected ? "active" : ""}
                  key={playbook.id}
                  onClick={() => onSelectPlaybook(playbook.id)}
                  data-testid={`playbook-select-${playbook.id}`}
                >
                  <Icon size={15} />
                  <span>
                    <strong>{playbook.label}</strong>
                    <small>{playbook.detail}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="playbook-runner">
          <div className="playbook-progress-card">
            <div>
              <span>{memory.lastRunAt ? `Last run ${formatRelativeTime(memory.lastRunAt)}` : "Not run yet"}</span>
              <strong>{completed}/{steps.length} steps complete</strong>
              <small>{nextStep ? `Next: ${nextStep.title}` : "All playbook steps are done."}</small>
            </div>
            <div className="playbook-progress-bar" aria-label="Playbook completion">
              <span style={{ width: `${completion}%` }} />
            </div>
          </div>

          <div className="playbook-step-list">
            {steps.map((step) => {
              const Icon = step.icon;
              const done = completedSet.has(step.id);

              return (
                <article className={`playbook-step step-${step.tone} ${done ? "done" : ""}`} key={step.id}>
                  <button type="button" className="playbook-check" aria-pressed={done} onClick={() => onToggleStep(step.id)} data-testid={`playbook-toggle-${step.id}`}>
                    {done ? <CheckCircle2 size={15} /> : <Icon size={15} />}
                  </button>
                  <div className="playbook-step-main">
                    <span>{step.target}</span>
                    <strong>{step.title}</strong>
                    <small>{step.detail}</small>
                  </div>
                  <div className="playbook-step-side">
                    <em>{step.metric}</em>
                    <button type="button" onClick={() => step.action()} data-testid={`playbook-open-${step.id}`}>
                      Open
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="playbook-preview">
          <div className="playbook-section-title">
            <Target size={15} />
            <strong>Focus signal</strong>
            <span>{activePlaybook.tone}</span>
          </div>
          <div className={`playbook-preview-card preview-${activePlaybook.tone}`}>
            <span>{activePlaybook.label}</span>
            <strong>{headlineForPlaybook(activePlaybook.id, signals)}</strong>
            <p>{detailForPlaybook(activePlaybook.id, signals)}</p>
            <div className="playbook-preview-tags">
              <em>{signals.blocked.length} blocked</em>
              <em>{signals.aiGaps.length} AI gaps</em>
              <em>{signals.ready.length} ready</em>
              <em>{signals.unresolvedThreads} threads</em>
            </div>
          </div>

          <div className="playbook-pr-strip">
            <div className="playbook-section-title">
              <TimerReset size={15} />
              <strong>Top PRs</strong>
            </div>
            {signals.activePrs.slice(0, 4).map((pr, index) => (
              <button type="button" key={pr.id} onClick={() => (pr.codex.exists ? onMarkReady(pr.id) : onPromoteCodex(pr.id))}>
                <span>
                  <strong>#{pr.number} {pr.title}</strong>
                  <small>{pr.repo} · {formatRelativeTime(pr.updatedAt)}</small>
                </span>
                <span>
                  <StatusPill state={pr.state} />
                  <CiBadge state={pr.ci} />
                  <CodexBadge reaction={pr.codex.reaction} compact />
                  <em>{getPrIntelligence(pr, index).readiness}/{getPrIntelligence(pr, index).readinessTotal}</em>
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function PlaybookMetric({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  tone: PlaybookTone;
  icon: LucideIcon;
}) {
  return (
    <div className={`playbook-metric metric-${tone}`}>
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function buildSignals(
  repos: RepoSummary[],
  pullRequests: PullRequestSummary[],
  reviewMemory: ReviewMemoryByPr,
  reviewThreads: ReviewThreadMemoryById,
): PlaybookSignals {
  const activePrs = pullRequests.filter((pr) => pr.state !== "merged");
  const blocked = activePrs.filter((pr, index) => {
    const intel = getPrIntelligence(pr, index);
    return pr.ci === "failure" || pr.state === "changes_requested" || reviewMemory[pr.id]?.decision === "blocked" || intel.risk === "high";
  });
  const ready = activePrs.filter((pr, index) => {
    const intel = getPrIntelligence(pr, index);
    const memory = reviewMemory[pr.id];
    return !pr.isDraft && pr.ci === "success" && memory?.decision !== "blocked" && (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1);
  });
  const aiGaps = activePrs.filter((pr) => !pr.codex.exists || pr.codex.reaction === "eyes");
  const reviewWait = activePrs.filter((pr) => pr.state === "waiting_review" || pr.reviewers.length === 0 || pr.isDraft);
  const stackCount = new Set(activePrs.map((pr, index) => `${pr.repo}:${getPrIntelligence(pr, index).stackName}`)).size;
  const unresolvedThreads =
    estimateThreadCount(activePrs, reviewMemory) -
    Object.values(reviewThreads).filter((thread) => thread.status === "resolved" || thread.status === "muted").length;

  return {
    activePrs,
    blocked,
    ready,
    aiGaps,
    reviewWait,
    unresolvedThreads: Math.max(0, unresolvedThreads),
    repoCount: repos.length,
    stackCount,
  };
}

function buildPlaybookSteps(
  id: AutopilotPlaybookId,
  signals: PlaybookSignals,
  actions: {
    onOpenStackNavigator: () => void;
    onOpenThreadResolver: () => void;
    onOpenBatchCart: () => void;
    onOpenDailyDigest: () => void;
    onOpenDecisionSimulator: () => void;
    onOpenTriageBoard: () => void;
    onPromoteCodex: (id: string) => void;
    onMarkReady: (id: string) => void;
  },
) {
  const aiFocus = signals.aiGaps[0];
  const readyFocus = signals.ready[0];

  if (id === "pre_merge") {
    return [
      makeStep("pre-merge-simulate", "Simulate queue impact", "Model queue time, review load, and blocker risk before staging work.", "Decision simulator", `${signals.ready.length} ready`, "blue", Workflow, actions.onOpenDecisionSimulator),
      makeStep("pre-merge-batch", "Stage ship candidates", "Load green PRs into the batch command cart and prepare the merge train.", "Batch cart", `${signals.ready.length} PRs`, "green", GitMerge, actions.onOpenBatchCart),
      makeStep("pre-merge-threads", "Clear merge-blocking threads", "Resolve human comments, CI failures, and Codex evidence before merge.", "Thread resolver", `${signals.unresolvedThreads} threads`, signals.unresolvedThreads ? "red" : "green", ShieldAlert, actions.onOpenThreadResolver),
      makeStep("pre-merge-digest", "Prepare ship-room update", "Draft a release note for what is ready and what is still blocked.", "Daily digest", "handoff", "amber", MessageSquareText, actions.onOpenDailyDigest),
    ];
  }

  if (id === "ai_sweep") {
    return [
      makeStep("ai-sweep-promote", "Promote the highest AI gap", aiFocus ? `Move #${aiFocus.number} toward Codex thumbs-up coverage.` : "No open Codex gap needs promotion.", "Codex action", `${signals.aiGaps.length} gaps`, "purple", Bot, () => aiFocus && actions.onPromoteCodex(aiFocus.id)),
      makeStep("ai-sweep-threads", "Review AI-related threads", "Inspect eyes-only, missing, and changed Codex signals in the reply queue.", "Thread resolver", `${signals.unresolvedThreads} threads`, "purple", RadioTower, actions.onOpenThreadResolver),
      makeStep("ai-sweep-stack", "Verify stack order after AI", "Use stack context to make sure promoted AI coverage still matches branch order.", "Stack navigator", `${signals.stackCount} stacks`, "blue", Workflow, actions.onOpenStackNavigator),
      makeStep("ai-sweep-digest", "Summarize AI coverage", "Turn remaining Codex gaps into a compact team update.", "Daily digest", `${signals.aiGaps.length} gaps`, "amber", MessageSquareText, actions.onOpenDailyDigest),
    ];
  }

  if (id === "release_handoff") {
    return [
      makeStep("release-triage", "Confirm current operating lanes", "Check blocker, review, AI, and ship lanes before publishing status.", "Triage board", `${signals.blocked.length} blockers`, "blue", Target, actions.onOpenTriageBoard),
      makeStep("release-ready", "Mark top ready candidate", readyFocus ? `Complete readiness for #${readyFocus.number}.` : "No green candidate is ready for handoff yet.", "Ready action", `${signals.ready.length} ready`, "green", CheckCircle2, () => readyFocus && actions.onMarkReady(readyFocus.id)),
      makeStep("release-compose", "Compose release digest", "Package decisions, blockers, ship-ready PRs, and AI gaps into a sendable update.", "Daily digest", "compose", "amber", MessageSquareText, actions.onOpenDailyDigest),
      makeStep("release-batch", "Preserve next command set", "Keep the next batch action staged for the next review window.", "Batch cart", "next run", "purple", Clipboard, actions.onOpenBatchCart),
    ];
  }

  return [
    makeStep("morning-threads", "Own review threads", "Draft or resolve comments, requested changes, CI failures, and Codex evidence.", "Thread resolver", `${signals.unresolvedThreads} threads`, signals.unresolvedThreads ? "red" : "green", MessageSquareText, actions.onOpenThreadResolver),
    makeStep("morning-stack", "Walk the priority stack", "Review the active stack bottom-up and pick the next command.", "Stack navigator", `${signals.stackCount} stacks`, "blue", Workflow, actions.onOpenStackNavigator),
    makeStep("morning-batch", "Stage cross-repo commands", "Select AI, unblock, review, or ship candidates in one batch.", "Batch cart", `${signals.activePrs.length} PRs`, "purple", Sparkles, actions.onOpenBatchCart),
    makeStep("morning-digest", "Draft the day’s update", "Create a concise digest from blockers, AI coverage, ready work, and journal state.", "Daily digest", "sendable", "amber", MessageSquareText, actions.onOpenDailyDigest),
  ];
}

function makeStep(
  id: string,
  title: string,
  detail: string,
  target: string,
  metric: string,
  tone: PlaybookTone,
  icon: LucideIcon,
  action: () => void,
): PlaybookStep {
  return { id, title, detail, target, metric, tone, icon, action };
}

function estimateThreadCount(
  pullRequests: PullRequestSummary[],
  reviewMemory: ReviewMemoryByPr,
) {
  return pullRequests.reduce((count, pr) => {
    const reviewEvents = pr.reviewEvents.filter((event) => !event.reviewer.isCodex && event.state !== "approved" && event.state !== "dismissed").length;
    const ci = pr.ci === "failure" ? 1 : 0;
    const codexGap = !pr.codex.exists || pr.codex.reaction === "eyes" ? 1 : 0;
    const codexShift = pr.codex.reaction === "changed" ? 1 : 0;
    const decision = reviewMemory[pr.id]?.note && reviewMemory[pr.id]?.decision !== "watch" ? 1 : 0;
    return count + reviewEvents + ci + codexGap + codexShift + decision;
  }, 0);
}

function formatRunbook(
  playbook: PlaybookConfig,
  steps: PlaybookStep[],
  signals: PlaybookSignals,
  completedStepIds: string[],
) {
  const completed = new Set(completedStepIds);

  return [
    `GitTrack autopilot playbook · ${playbook.label}`,
    `${signals.activePrs.length} active PRs · ${signals.blocked.length} blockers · ${signals.aiGaps.length} AI gaps · ${signals.ready.length} ship-ready`,
    "",
    ...steps.map((step, index) => `${index + 1}. [${completed.has(step.id) ? "x" : " "}] ${step.title} · ${step.target} · ${step.metric}`),
  ].join("\n");
}

function headlineForPlaybook(id: AutopilotPlaybookId, signals: PlaybookSignals) {
  if (id === "pre_merge") return `${signals.ready.length} PRs can enter the merge train`;
  if (id === "ai_sweep") return `${signals.aiGaps.length} Codex signals need closure`;
  if (id === "release_handoff") return `${signals.blocked.length} blockers must be called out`;
  return `${signals.unresolvedThreads} threads define the morning`;
}

function detailForPlaybook(id: AutopilotPlaybookId, signals: PlaybookSignals) {
  if (id === "pre_merge") return "Simulate queue impact, stage green work, clear blockers, and draft the ship-room update.";
  if (id === "ai_sweep") return "Promote missing or eyes-only Codex reviews, then verify the stack and summarize coverage.";
  if (id === "release_handoff") return "Turn triage lanes, ready work, and remaining risks into a handoff that can be sent.";
  return `${signals.reviewWait.length} review waits, ${signals.blocked.length} blockers, and ${signals.aiGaps.length} AI gaps are ready for an ordered pass.`;
}
