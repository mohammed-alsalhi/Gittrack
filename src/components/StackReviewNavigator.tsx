import { useMemo } from "react";
import {
  Bot,
  CheckCircle2,
  Clipboard,
  Eye,
  GitBranch,
  GitMerge,
  GitPullRequest,
  RadioTower,
  ShieldAlert,
  Sparkles,
  Target,
  TimerReset,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import type {
  PullRequestSummary,
  ReviewMemoryByPr,
  StackReviewMode,
  StackReviewNavigatorMemory,
} from "../types";
import { AvatarStack, CiBadge, CodexBadge, formatRelativeTime, StatusPill } from "./ui";

interface StackReviewNavigatorProps {
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  memory: StackReviewNavigatorMemory;
  selectedPrId?: string;
  onMemoryChange: (patch: Partial<StackReviewNavigatorMemory>) => void;
  onOpenPullRequest: (repo: string, id: string) => void;
  onPinReview: (id: string) => void;
  onPromoteCodex: (id: string) => void;
  onMarkReady: (id: string) => void;
  onMarkBlocked: (id: string) => void;
  onSmartMerge: (id: string) => void;
  onCopyStackPlan: (text: string, count: number) => void;
}

interface StackModel {
  key: string;
  repo: string;
  name: string;
  pullRequests: PullRequestSummary[];
  activeCount: number;
  readyCount: number;
  blockerCount: number;
  aiGapCount: number;
  fileCount: number;
  readiness: number;
  readinessTotal: number;
  queueMinutes: number;
}

type StackAction = "merge" | "ready" | "review" | "ai" | "unblock";

interface StackActionConfig {
  id: StackAction;
  label: string;
  detail: string;
  tone: StackTone;
  icon: LucideIcon;
}

interface StackModeConfig {
  id: StackReviewMode;
  label: string;
  detail: string;
  icon: LucideIcon;
}

type StackTone = "blue" | "green" | "amber" | "red" | "purple";

const stackModes: StackModeConfig[] = [
  {
    id: "bottom_up",
    label: "Bottom-up",
    detail: "Review closest to main first.",
    icon: Workflow,
  },
  {
    id: "risk_first",
    label: "Risk first",
    detail: "Pull blockers and red checks up.",
    icon: ShieldAlert,
  },
  {
    id: "ship_ready",
    label: "Ship-ready",
    detail: "Prioritize green queue work.",
    icon: GitMerge,
  },
];

const stackActions: Record<StackAction, StackActionConfig> = {
  merge: {
    id: "merge",
    label: "Queue merge",
    detail: "Green gates are ready for the merge train.",
    tone: "green",
    icon: GitMerge,
  },
  ready: {
    id: "ready",
    label: "Mark ready",
    detail: "Complete the review checklist before merge.",
    tone: "green",
    icon: CheckCircle2,
  },
  review: {
    id: "review",
    label: "Pin review",
    detail: "Keep this PR in your active review lane.",
    tone: "amber",
    icon: Target,
  },
  ai: {
    id: "ai",
    label: "Promote AI",
    detail: "Move Codex coverage from missing or eyes to thumbs up.",
    tone: "purple",
    icon: Bot,
  },
  unblock: {
    id: "unblock",
    label: "Mark blocked",
    detail: "Track requested changes or failing checks as unblock work.",
    tone: "red",
    icon: ShieldAlert,
  },
};

export function StackReviewNavigator({
  pullRequests,
  reviewMemory,
  memory,
  selectedPrId,
  onMemoryChange,
  onOpenPullRequest,
  onPinReview,
  onPromoteCodex,
  onMarkReady,
  onMarkBlocked,
  onSmartMerge,
  onCopyStackPlan,
}: StackReviewNavigatorProps) {
  const stacks = useMemo(() => buildStacks(pullRequests, reviewMemory, memory.includeMerged), [
    memory.includeMerged,
    pullRequests,
    reviewMemory,
  ]);
  const selectedStack =
    stacks.find((stack) => stack.key === memory.selectedStackKey) ??
    stacks.find((stack) => stack.pullRequests.some((pr) => pr.id === selectedPrId)) ??
    stacks[0];
  const orderedPullRequests = selectedStack
    ? orderStackPullRequests(selectedStack.pullRequests, memory.mode, reviewMemory)
    : [];
  const nextPullRequest = orderedPullRequests.find((pr) => pr.state !== "merged") ?? orderedPullRequests[0];
  const nextAction = nextPullRequest ? getNextAction(nextPullRequest, reviewMemory) : undefined;
  const planText = selectedStack
    ? formatStackPlan(selectedStack, orderedPullRequests, memory.mode, reviewMemory)
    : "No stack selected.";
  const totalActive = stacks.reduce((sum, stack) => sum + stack.activeCount, 0);
  const totalAiGaps = stacks.reduce((sum, stack) => sum + stack.aiGapCount, 0);
  const totalBlockers = stacks.reduce((sum, stack) => sum + stack.blockerCount, 0);
  const shipReadyStacks = stacks.filter((stack) => stack.readyCount > 0 && stack.blockerCount === 0).length;

  return (
    <section className="stack-navigator" id="stack-review-navigator" data-testid="stack-review-navigator">
      <div className="stack-nav-head">
        <div>
          <span>Stack navigator</span>
          <h2>{selectedStack ? `${selectedStack.name} review path` : "Build a stack review path"}</h2>
          <p>Work a Graphite-style stack from the PR inbox: see ordering, review gaps, AI coverage, and the next command without losing context.</p>
        </div>
        <div className="stack-nav-actions">
          <button
            type="button"
            className={memory.includeMerged ? "active" : ""}
            onClick={() => onMemoryChange({ includeMerged: !memory.includeMerged })}
            data-testid="stack-include-merged"
          >
            <Eye size={14} />
            {memory.includeMerged ? "Merged on" : "Merged off"}
          </button>
          <button type="button" onClick={() => onCopyStackPlan(planText, orderedPullRequests.length)} data-testid="stack-copy-plan">
            <Clipboard size={14} />
            Copy stack
          </button>
          <button
            type="button"
            disabled={!nextPullRequest || !nextAction}
            onClick={() => nextPullRequest && nextAction && runStackAction(nextAction.id, nextPullRequest.id, {
              onPinReview,
              onPromoteCodex,
              onMarkReady,
              onMarkBlocked,
              onSmartMerge,
            })}
            data-testid="stack-next-action"
          >
            <Sparkles size={14} />
            {nextAction ? nextAction.label : "No action"}
          </button>
        </div>
      </div>

      <div className="stack-nav-metrics" aria-label="Stack navigator metrics">
        <StackMetric label="Stacks" value={stacks.length} detail={`${totalActive} active PRs`} tone="blue" icon={GitBranch} />
        <StackMetric label="Ship lanes" value={shipReadyStacks} detail="green stacks" tone={shipReadyStacks ? "green" : "blue"} icon={GitMerge} />
        <StackMetric label="AI gaps" value={totalAiGaps} detail="needs Codex" tone={totalAiGaps ? "purple" : "green"} icon={Bot} />
        <StackMetric label="Blockers" value={totalBlockers} detail="requested changes" tone={totalBlockers ? "red" : "green"} icon={ShieldAlert} />
      </div>

      <div className="stack-nav-body">
        <aside className="stack-list" aria-label="Stacks">
          <div className="stack-section-title">
            <GitPullRequest size={15} />
            <strong>Inbox stacks</strong>
            <span>{stacks.length}</span>
          </div>
          <div className="stack-list-items">
            {stacks.map((stack) => (
              <button
                type="button"
                key={stack.key}
                className={selectedStack?.key === stack.key ? "active" : ""}
                onClick={() => onMemoryChange({ selectedStackKey: stack.key })}
                data-testid={`stack-select-${toTestId(stack.key)}`}
              >
                <span>
                  <strong>{stack.name}</strong>
                  <small>{stack.repo} · {stack.activeCount} active · {stack.fileCount} files</small>
                </span>
                <em>{stack.readyCount}/{stack.pullRequests.length}</em>
                <i className={stack.blockerCount ? "danger" : stack.aiGapCount ? "purple" : "green"}>
                  {stack.blockerCount ? `${stack.blockerCount} blocked` : stack.aiGapCount ? `${stack.aiGapCount} AI` : "clear"}
                </i>
              </button>
            ))}
          </div>
        </aside>

        <div className="stack-workbench">
          <div className="stack-mode-tabs" role="tablist" aria-label="Stack review mode">
            {stackModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  type="button"
                  role="tab"
                  key={mode.id}
                  aria-selected={memory.mode === mode.id}
                  className={memory.mode === mode.id ? "active" : ""}
                  onClick={() => onMemoryChange({ mode: mode.id })}
                  data-testid={`stack-mode-${mode.id}`}
                >
                  <Icon size={14} />
                  <span>
                    <strong>{mode.label}</strong>
                    <small>{mode.detail}</small>
                  </span>
                </button>
              );
            })}
          </div>

          {selectedStack ? (
            <div className="stack-path">
              <div className="stack-path-summary">
                <div>
                  <span>{selectedStack.repo}</span>
                  <strong>{selectedStack.name}</strong>
                  <small>{selectedStack.readiness}/{selectedStack.readinessTotal} gates · {selectedStack.queueMinutes}m queue · {selectedStack.fileCount} files touched</small>
                </div>
                <div className="stack-readiness-bar" aria-label="Stack readiness">
                  <span style={{ width: `${Math.round((selectedStack.readiness / selectedStack.readinessTotal) * 100)}%` }} />
                </div>
              </div>

              <div className="stack-rail" aria-label="Stack order">
                {orderedPullRequests.map((pr, index) => {
                  const intel = getPrIntelligence(pr, index);
                  const action = getNextAction(pr, reviewMemory);
                  const active = pr.id === selectedPrId;

                  return (
                    <article className={`stack-step step-${action.id} ${active ? "selected" : ""}`} key={pr.id}>
                      <button type="button" className="stack-node" onClick={() => onOpenPullRequest(pr.repo, pr.id)}>
                        <b>{intel.stackIndex}</b>
                        <span />
                      </button>
                      <div className="stack-step-main">
                        <div className="stack-step-copy">
                          <span>#{pr.number} · {formatRelativeTime(pr.updatedAt)}</span>
                          <strong>{pr.title}</strong>
                          <small>{pr.branch} → {pr.base}</small>
                        </div>
                        <div className="stack-step-signals">
                          <StatusPill state={pr.state} />
                          <CiBadge state={pr.ci} />
                          <CodexBadge reaction={pr.codex.reaction} compact />
                          <AvatarStack people={pr.reviewers} />
                          <em>{intel.readiness}/{intel.readinessTotal}</em>
                        </div>
                      </div>
                      <div className="stack-step-action">
                        <span className={`stack-action-label action-${action.tone}`}>
                          <action.icon size={13} />
                          {action.label}
                        </span>
                        <small>{action.detail}</small>
                        <div>
                          <button type="button" onClick={() => runStackAction(action.id, pr.id, {
                            onPinReview,
                            onPromoteCodex,
                            onMarkReady,
                            onMarkBlocked,
                            onSmartMerge,
                          })} data-testid={`stack-run-${pr.number}`}>
                            Run
                          </button>
                          <button type="button" onClick={() => onOpenPullRequest(pr.repo, pr.id)} data-testid={`stack-open-${pr.number}`}>
                            Open
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="stack-empty">
              <CheckCircle2 size={18} />
              <strong>No stacks available.</strong>
              <span>Refresh GitHub data or include merged work to inspect older stacks.</span>
            </div>
          )}
        </div>

        <aside className="stack-plan">
          <div className="stack-section-title">
            <RadioTower size={15} />
            <strong>Next command</strong>
            <span>{memory.mode.replace("_", " ")}</span>
          </div>
          {nextPullRequest && nextAction ? (
            <div className={`stack-plan-card plan-${nextAction.tone}`}>
              <span>{nextPullRequest.repo}</span>
              <strong>#{nextPullRequest.number} {nextPullRequest.title}</strong>
              <p>{nextAction.detail}</p>
              <div className="stack-plan-signals">
                <em>{selectedStack?.readyCount ?? 0} ready</em>
                <em>{selectedStack?.blockerCount ?? 0} blocked</em>
                <em>{selectedStack?.aiGapCount ?? 0} AI gaps</em>
                <em>{selectedStack?.queueMinutes ?? 0}m queue</em>
              </div>
              <button
                type="button"
                onClick={() => runStackAction(nextAction.id, nextPullRequest.id, {
                  onPinReview,
                  onPromoteCodex,
                  onMarkReady,
                  onMarkBlocked,
                  onSmartMerge,
                })}
              >
                <nextAction.icon size={14} />
                {nextAction.label}
              </button>
            </div>
          ) : (
            <div className="stack-empty stack-empty-small">
              <CheckCircle2 size={17} />
              <strong>No next command.</strong>
              <span>This stack has no active pull requests in view.</span>
            </div>
          )}
          <div className="stack-plan-note">
            <TimerReset size={15} />
            <span>Bottom-up mode mirrors stack review: closest-to-main first, then each dependent PR with fresh AI and CI signals.</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function StackMetric({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  tone: StackTone;
  icon: LucideIcon;
}) {
  return (
    <div className={`stack-metric metric-${tone}`}>
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function buildStacks(
  pullRequests: PullRequestSummary[],
  reviewMemory: ReviewMemoryByPr,
  includeMerged: boolean,
) {
  const stacks = new Map<string, PullRequestSummary[]>();

  pullRequests
    .filter((pr) => includeMerged || pr.state !== "merged")
    .forEach((pr, index) => {
      const intel = getPrIntelligence(pr, index);
      const key = `${pr.repo}:${intel.stackName}`;
      stacks.set(key, [...(stacks.get(key) ?? []), pr]);
    });

  return [...stacks.entries()]
    .map(([key, prs]) => buildStackModel(key, prs, reviewMemory))
    .sort((a, b) => b.activeCount - a.activeCount || b.blockerCount - a.blockerCount || a.name.localeCompare(b.name));
}

function buildStackModel(
  key: string,
  pullRequests: PullRequestSummary[],
  reviewMemory: ReviewMemoryByPr,
): StackModel {
  const ordered = orderStackPullRequests(pullRequests, "bottom_up", reviewMemory);
  const first = ordered[0];
  const insights = ordered.map((pr, index) => getPrIntelligence(pr, index));
  const activeCount = ordered.filter((pr) => pr.state !== "merged").length;
  const readyCount = ordered.filter((pr, index) => isReadyForMerge(pr, insights[index], reviewMemory)).length;
  const blockerCount = ordered.filter((pr) => pr.ci === "failure" || pr.state === "changes_requested" || reviewMemory[pr.id]?.decision === "blocked").length;
  const aiGapCount = ordered.filter((pr) => !pr.codex.exists || pr.codex.reaction === "eyes").length;
  const fileCount = new Set(insights.flatMap((intel) => intel.files)).size;
  const readiness = insights.reduce((sum, intel) => sum + intel.readiness, 0);
  const readinessTotal = insights.reduce((sum, intel) => sum + intel.readinessTotal, 0) || 1;
  const queueMinutes = insights.reduce((sum, intel) => sum + Number.parseInt(intel.queueEstimate, 10), 0) || Math.max(4, ordered.length * 5);

  return {
    key,
    repo: first?.repo ?? "Unknown repo",
    name: first ? getPrIntelligence(first).stackName : key.split(":").pop() ?? "Stack",
    pullRequests: ordered,
    activeCount,
    readyCount,
    blockerCount,
    aiGapCount,
    fileCount,
    readiness,
    readinessTotal,
    queueMinutes,
  };
}

function orderStackPullRequests(
  pullRequests: PullRequestSummary[],
  mode: StackReviewMode,
  reviewMemory: ReviewMemoryByPr,
) {
  const riskRank = { high: 3, medium: 2, low: 1 };
  const active = [...pullRequests];

  if (mode === "risk_first") {
    return active.sort((a, b) => {
      const aAction = getNextAction(a, reviewMemory);
      const bAction = getNextAction(b, reviewMemory);
      const actionRank = (action: StackAction) => (action === "unblock" ? 4 : action === "ai" ? 3 : action === "review" ? 2 : 1);
      const aIntel = getPrIntelligence(a);
      const bIntel = getPrIntelligence(b);
      return (
        actionRank(bAction.id) - actionRank(aAction.id) ||
        riskRank[bIntel.risk] - riskRank[aIntel.risk] ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }

  if (mode === "ship_ready") {
    return active.sort((a, b) => {
      const aIntel = getPrIntelligence(a);
      const bIntel = getPrIntelligence(b);
      const aReady = isReadyForMerge(a, aIntel, reviewMemory) ? 1 : 0;
      const bReady = isReadyForMerge(b, bIntel, reviewMemory) ? 1 : 0;
      return (
        bReady - aReady ||
        bIntel.readiness / bIntel.readinessTotal - aIntel.readiness / aIntel.readinessTotal ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }

  return active.sort((a, b) => getPrIntelligence(a).stackIndex - getPrIntelligence(b).stackIndex);
}

function getNextAction(
  pr: PullRequestSummary,
  reviewMemory: ReviewMemoryByPr,
) {
  const memory = reviewMemory[pr.id];
  const intel = getPrIntelligence(pr);

  if (pr.ci === "failure" || pr.state === "changes_requested" || memory?.decision === "blocked") return stackActions.unblock;
  if (!pr.codex.exists || pr.codex.reaction === "eyes") return stackActions.ai;
  if (pr.isDraft || pr.state === "waiting_review" || !pr.reviewers.length) return stackActions.review;
  if (isReadyForMerge(pr, intel, reviewMemory)) return stackActions.merge;
  return stackActions.ready;
}

function isReadyForMerge(
  pr: PullRequestSummary,
  intel = getPrIntelligence(pr),
  reviewMemory: ReviewMemoryByPr,
) {
  const memory = reviewMemory[pr.id];
  const snoozed = Boolean(memory?.snoozedUntil && new Date(memory.snoozedUntil).getTime() > Date.now());

  return (
    !snoozed &&
    !pr.isDraft &&
    pr.ci === "success" &&
    pr.state !== "changes_requested" &&
    memory?.decision !== "blocked" &&
    (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1)
  );
}

function runStackAction(
  action: StackAction,
  id: string,
  handlers: {
    onPinReview: (id: string) => void;
    onPromoteCodex: (id: string) => void;
    onMarkReady: (id: string) => void;
    onMarkBlocked: (id: string) => void;
    onSmartMerge: (id: string) => void;
  },
) {
  if (action === "merge") handlers.onSmartMerge(id);
  if (action === "ready") handlers.onMarkReady(id);
  if (action === "review") handlers.onPinReview(id);
  if (action === "ai") handlers.onPromoteCodex(id);
  if (action === "unblock") handlers.onMarkBlocked(id);
}

function formatStackPlan(
  stack: StackModel,
  pullRequests: PullRequestSummary[],
  mode: StackReviewMode,
  reviewMemory: ReviewMemoryByPr,
) {
  return [
    `GitTrack stack plan · ${stack.name}`,
    `${stack.repo} · ${mode.replace("_", " ")} · ${pullRequests.length} PRs`,
    `${stack.readyCount} ready · ${stack.blockerCount} blocked · ${stack.aiGapCount} AI gaps · ${stack.queueMinutes}m queue`,
    "",
    ...pullRequests.map((pr) => {
      const action = getNextAction(pr, reviewMemory);
      return `- #${pr.number} ${pr.title} · ${action.label} · ${pr.ciSummary}`;
    }),
  ].join("\n");
}

function toTestId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
