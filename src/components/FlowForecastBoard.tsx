import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clipboard,
  GitMerge,
  GitPullRequest,
  Route,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence, type PrIntelligence } from "../lib/insights";
import type { BranchSummary, PullRequestSummary, ReviewMemory, ReviewMemoryByPr } from "../types";
import { CiBadge, CodexBadge, formatRelativeTime } from "./ui";

type ForecastPhaseId = "blockers" | "ai" | "ready" | "train";
type ForecastTone = "green" | "amber" | "red" | "purple" | "blue";
type ForecastAction = "open" | "promote" | "ready" | "merge";

interface FlowForecastBoardProps {
  activeRepo: string;
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  reviewMemory: ReviewMemoryByPr;
  selectedPrId?: string;
  onSelectPullRequest: (id: string) => void;
  onPromoteCodex: (id: string) => void;
  onMarkReady: (id: string) => void;
  onSmartMerge: (id: string) => void;
  onCopyForecast: (text: string, count: number) => void;
  onOpenBatchCart: () => void;
}

interface ForecastItem {
  pr: PullRequestSummary;
  intel: PrIntelligence;
  memory?: ReviewMemory;
}

interface ForecastPhase {
  id: ForecastPhaseId;
  label: string;
  value: number;
  total: number;
  detail: string;
  tone: ForecastTone;
  icon: LucideIcon;
  items: ForecastItem[];
}

interface NextMove {
  id: string;
  label: string;
  detail: string;
  action: ForecastAction;
  item: ForecastItem;
  tone: ForecastTone;
  icon: LucideIcon;
}

export function FlowForecastBoard({
  activeRepo,
  pullRequests,
  branches,
  reviewMemory,
  selectedPrId,
  onSelectPullRequest,
  onPromoteCodex,
  onMarkReady,
  onSmartMerge,
  onCopyForecast,
  onOpenBatchCart,
}: FlowForecastBoardProps) {
  const model = useMemo(
    () => buildFlowForecast(activeRepo, pullRequests, branches, reviewMemory),
    [activeRepo, branches, pullRequests, reviewMemory],
  );
  const [activePhaseId, setActivePhaseId] = useState<ForecastPhaseId>(model.defaultPhaseId);
  const activePhase = model.phases.find((phase) => phase.id === activePhaseId) ?? model.phases[0];
  const visibleItems = activePhase?.items.slice(0, 4) ?? [];

  return (
    <section className="flow-forecast-board" data-testid="flow-forecast-board" aria-label="Flow forecast">
      <div className="flow-forecast-head">
        <div>
          <span>Flow forecast</span>
          <h2>{model.headline}</h2>
        </div>
        <div className="flow-forecast-actions">
          <button type="button" onClick={() => onCopyForecast(model.copy, model.activeCount)} data-testid="copy-flow-forecast">
            <Clipboard size={14} />
            Copy plan
          </button>
          <button type="button" onClick={onOpenBatchCart}>
            <Route size={14} />
            Batch queue
          </button>
        </div>
      </div>

      <div className="flow-forecast-meter" aria-label="Ship confidence">
        <div>
          <span>Ship confidence</span>
          <strong>{model.confidence}%</strong>
        </div>
        <div className="flow-confidence-track">
          <span style={{ width: `${model.confidence}%` }} />
        </div>
        <small>{model.summary}</small>
      </div>

      <div className="flow-forecast-grid">
        <div className="flow-phase-column">
          <div className="flow-phase-track" aria-label="Forecast phases">
            {model.phases.map((phase) => {
              const Icon = phase.icon;
              const progress = phase.total ? Math.round((phase.value / phase.total) * 100) : 0;

              return (
                <button
                  type="button"
                  className={`flow-phase-card phase-${phase.tone} ${phase.id === activePhase.id ? "active" : ""}`}
                  key={phase.id}
                  onClick={() => setActivePhaseId(phase.id)}
                  data-testid={`flow-phase-${phase.id}`}
                >
                  <span className="flow-phase-icon">
                    <Icon size={15} />
                  </span>
                  <span className="flow-phase-copy">
                    <strong>{phase.label}</strong>
                    <small>{phase.detail}</small>
                  </span>
                  <span className="flow-phase-value">
                    <strong>{phase.value}</strong>
                    <small>{progress}%</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flow-stack-map" aria-label="Stack pressure map">
            <div className="flow-section-title">
              <span>Stack pressure</span>
              <strong>{model.stacks.length}</strong>
            </div>
            {model.stacks.map((stack) => (
              <button
                type="button"
                className={`flow-stack-row pressure-${stack.tone}`}
                key={stack.key}
                onClick={() => stack.firstPrId && onSelectPullRequest(stack.firstPrId)}
              >
                <span>
                  <strong>{stack.label}</strong>
                  <small>{stack.detail}</small>
                </span>
                <em>{stack.score}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="flow-focus-column">
          <div className="flow-section-title">
            <span>{activePhase?.label ?? "Phase"} lane</span>
            <strong>{activePhase?.items.length ?? 0}</strong>
          </div>

          <div className="flow-lane-list">
            {visibleItems.map((item) => (
              <button
                type="button"
                className={`flow-lane-item ${item.pr.id === selectedPrId ? "selected" : ""}`}
                key={item.pr.id}
                onClick={() => onSelectPullRequest(item.pr.id)}
              >
                <span className="flow-pr-number">#{item.pr.number}</span>
                <span className="flow-lane-copy">
                  <strong>{item.pr.title}</strong>
                  <small>
                    {item.pr.branch} · {formatRelativeTime(item.pr.updatedAt)}
                  </small>
                </span>
                <span className="flow-lane-badges">
                  <CiBadge state={item.pr.ci} />
                  <CodexBadge reaction={item.pr.codex.reaction} compact />
                </span>
              </button>
            ))}

            {!visibleItems.length && (
              <div className="flow-empty-lane">
                <CheckCircle2 size={18} />
                <strong>Lane clear</strong>
                <span>No pull requests need this move right now.</span>
              </div>
            )}
          </div>
        </div>

        <aside className="flow-next-column">
          <div className="flow-section-title">
            <span>Next moves</span>
            <strong>{model.nextMoves.length}</strong>
          </div>

          <div className="flow-next-list">
            {model.nextMoves.map((move) => {
              const Icon = move.icon;

              return (
                <article className={`flow-next-card move-${move.tone}`} key={move.id}>
                  <span className="flow-next-icon">
                    <Icon size={15} />
                  </span>
                  <div>
                    <strong>{move.label}</strong>
                    <p>{move.detail}</p>
                  </div>
                  <button type="button" onClick={() => runMove(move, { onSelectPullRequest, onPromoteCodex, onMarkReady, onSmartMerge })}>
                    {buttonLabelForAction(move.action)}
                    <ArrowRight size={13} />
                  </button>
                </article>
              );
            })}
          </div>
        </aside>
      </div>
    </section>
  );
}

function buildFlowForecast(
  activeRepo: string,
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  reviewMemory: ReviewMemoryByPr,
) {
  const items = pullRequests
    .filter((pr) => pr.state !== "merged")
    .map((pr, index) => ({
      pr,
      intel: getPrIntelligence(pr, index),
      memory: reviewMemory[pr.id],
    }));
  const branchByPr = new Map(
    branches
      .filter((branch) => branch.pullRequestNumber)
      .map((branch) => [`${branch.repo}#${branch.pullRequestNumber}`, branch]),
  );
  const blockers = items.filter((item) => isBlocked(item));
  const aiGaps = items.filter((item) => !item.pr.codex.exists || item.pr.codex.reaction === "eyes");
  const ready = items.filter((item) => isReady(item));
  const train = ready.filter((item) => item.pr.state === "approved" || item.memory?.decision === "ready");
  const drift = items.filter((item) => {
    const branch = branchByPr.get(`${item.pr.repo}#${item.pr.number}`);
    return branch && ["behind", "diverged", "stale"].includes(branch.health);
  });
  const activeCount = items.length;
  const runwayMinutes = Math.max(
    8,
    blockers.length * 9 + aiGaps.length * 5 + Math.max(0, activeCount - ready.length) * 4 + ready.length * 3,
  );
  const confidence = clamp(
    Math.round(72 + ready.length * 7 + train.length * 4 - blockers.length * 12 - drift.length * 4 - aiGaps.length * 3),
    32,
    98,
  );
  const phases: ForecastPhase[] = [
    {
      id: "blockers",
      label: "Unblock",
      value: blockers.length,
      total: Math.max(1, activeCount),
      detail: `${blockers.length} blocking merge flow`,
      tone: blockers.length ? "red" : "green",
      icon: ShieldAlert,
      items: blockers,
    },
    {
      id: "ai",
      label: "AI sweep",
      value: aiGaps.length,
      total: Math.max(1, activeCount),
      detail: `${aiGaps.length} Codex gaps`,
      tone: aiGaps.length ? "purple" : "green",
      icon: Bot,
      items: aiGaps,
    },
    {
      id: "ready",
      label: "Ready queue",
      value: ready.length,
      total: Math.max(1, activeCount),
      detail: `${ready.length} ready to stage`,
      tone: ready.length ? "green" : "amber",
      icon: CheckCircle2,
      items: ready,
    },
    {
      id: "train",
      label: "Merge train",
      value: train.length,
      total: Math.max(1, activeCount),
      detail: `${train.length} can ship now`,
      tone: train.length ? "blue" : "amber",
      icon: GitMerge,
      items: train,
    },
  ];
  const defaultPhaseId: ForecastPhaseId = blockers.length ? "blockers" : aiGaps.length ? "ai" : ready.length ? "ready" : "train";
  const stacks = buildStackPressure(items);
  const nextMoves = buildNextMoves(blockers, aiGaps, ready, items).slice(0, 3);
  const headline =
    blockers.length > 0
      ? `${activeRepo} needs ${blockers.length} unblock ${plural("move", blockers.length)}`
      : train.length > 0
        ? `${train.length} PR ${plural("slot", train.length)} can enter merge train`
        : `${activeRepo} review flow is stable`;
  const summary = `${activeCount} active PRs · ${formatMinutes(runwayMinutes)} loop · ${drift.length} drift ${plural("signal", drift.length)}`;

  return {
    activeCount,
    confidence,
    copy: formatForecastPlan(activeRepo, activeCount, runwayMinutes, confidence, phases, nextMoves),
    defaultPhaseId,
    headline,
    nextMoves,
    phases,
    stacks,
    summary,
  };
}

function isBlocked(item: ForecastItem) {
  return (
    item.pr.ci === "failure" ||
    item.pr.state === "changes_requested" ||
    item.memory?.decision === "blocked" ||
    item.intel.risk === "high"
  );
}

function isReady(item: ForecastItem) {
  return (
    !item.pr.isDraft &&
    item.pr.ci === "success" &&
    item.memory?.decision !== "blocked" &&
    (item.memory?.decision === "ready" ||
      item.pr.state === "approved" ||
      item.intel.readiness >= item.intel.readinessTotal - 1)
  );
}

function buildNextMoves(blockers: ForecastItem[], aiGaps: ForecastItem[], ready: ForecastItem[], allItems: ForecastItem[]): NextMove[] {
  const moves: NextMove[] = [];
  const blocker = blockers[0];
  const aiGap = aiGaps.find((item) => item.pr.codex.reaction === "eyes") ?? aiGaps[0];
  const readyItem = ready[0];
  const reviewItem = allItems.find((item) => !isBlocked(item) && !isReady(item));

  if (blocker) {
    moves.push({
      id: `block-${blocker.pr.id}`,
      label: `Unblock #${blocker.pr.number}`,
      detail: blocker.pr.ci === "failure" ? "Fix CI before this stack can move." : "Resolve requested changes or risk notes.",
      action: "open",
      item: blocker,
      tone: "red",
      icon: AlertTriangle,
    });
  }

  if (aiGap) {
    moves.push({
      id: `ai-${aiGap.pr.id}`,
      label: `Promote AI on #${aiGap.pr.number}`,
      detail: aiGap.pr.codex.exists ? "Codex is still at eyes; push it to thumbs up." : "No Codex review exists yet.",
      action: "promote",
      item: aiGap,
      tone: "purple",
      icon: Sparkles,
    });
  }

  if (readyItem) {
    moves.push({
      id: `merge-${readyItem.pr.id}`,
      label: `Stage #${readyItem.pr.number}`,
      detail: "Checks are green and readiness is high enough for the merge train.",
      action: "merge",
      item: readyItem,
      tone: "green",
      icon: GitMerge,
    });
  }

  if (!moves.length && reviewItem) {
    moves.push({
      id: `review-${reviewItem.pr.id}`,
      label: `Review #${reviewItem.pr.number}`,
      detail: "Move the next review forward and mark it ready when it clears.",
      action: "ready",
      item: reviewItem,
      tone: "blue",
      icon: GitPullRequest,
    });
  }

  return moves;
}

function buildStackPressure(items: ForecastItem[]) {
  const stacks = new Map<string, { key: string; label: string; count: number; blockers: number; ai: number; ready: number; firstPrId?: string }>();

  items.forEach((item) => {
    const key = item.intel.stackName;
    const stack =
      stacks.get(key) ??
      ({
        key,
        label: key,
        count: 0,
        blockers: 0,
        ai: 0,
        ready: 0,
        firstPrId: item.pr.id,
      } satisfies { key: string; label: string; count: number; blockers: number; ai: number; ready: number; firstPrId?: string });

    stack.count += 1;
    if (isBlocked(item)) stack.blockers += 1;
    if (!item.pr.codex.exists || item.pr.codex.reaction === "eyes") stack.ai += 1;
    if (isReady(item)) stack.ready += 1;
    stacks.set(key, stack);
  });

  return [...stacks.values()]
    .map((stack) => {
      const score = stack.blockers * 3 + stack.ai * 2 + Math.max(0, stack.count - stack.ready);
      const tone: ForecastTone = stack.blockers ? "red" : stack.ai ? "purple" : stack.ready ? "green" : "amber";

      return {
        ...stack,
        detail: `${stack.count} PRs · ${stack.blockers} blockers · ${stack.ai} AI gaps`,
        score,
        tone,
      };
    })
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 4);
}

function runMove(
  move: NextMove,
  handlers: Pick<FlowForecastBoardProps, "onSelectPullRequest" | "onPromoteCodex" | "onMarkReady" | "onSmartMerge">,
) {
  if (move.action === "promote") {
    handlers.onPromoteCodex(move.item.pr.id);
    return;
  }

  if (move.action === "ready") {
    handlers.onMarkReady(move.item.pr.id);
    return;
  }

  if (move.action === "merge") {
    handlers.onSmartMerge(move.item.pr.id);
    return;
  }

  handlers.onSelectPullRequest(move.item.pr.id);
}

function buttonLabelForAction(action: ForecastAction) {
  if (action === "promote") return "Promote";
  if (action === "ready") return "Mark ready";
  if (action === "merge") return "Merge";
  return "Open";
}

function formatForecastPlan(
  repo: string,
  activeCount: number,
  runwayMinutes: number,
  confidence: number,
  phases: ForecastPhase[],
  nextMoves: NextMove[],
) {
  const phaseLines = phases.map((phase) => `${phase.label}: ${phase.value} (${phase.detail})`);
  const moveLines = nextMoves.length
    ? nextMoves.map((move, index) => `${index + 1}. ${move.label} - ${move.detail}`)
    : ["No urgent next moves."];

  return [
    `Flow forecast for ${repo}`,
    `${activeCount} active PRs, ${confidence}% ship confidence, ~${formatMinutes(runwayMinutes)} loop`,
    "",
    "Lanes:",
    ...phaseLines,
    "",
    "Next moves:",
    ...moveLines,
  ].join("\n");
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function plural(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
