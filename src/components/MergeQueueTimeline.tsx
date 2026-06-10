import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  GitMerge,
  GitPullRequest,
  Play,
  ShieldCheck,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import { findBranchForPullRequest, getPullRequestActionState, type PullRequestActionState } from "../lib/prActions";
import type { BranchSummary, MergeQueueMemory, PullRequestSummary, ReviewMemoryByPr } from "../types";
import { CiBadge, formatRelativeTime, MiniCheck, StatusPill } from "./ui";

interface MergeQueueTimelineProps {
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  reviewMemory: ReviewMemoryByPr;
  mergeQueue: MergeQueueMemory;
  selectedId?: string;
  onSelectPullRequest: (id: string) => void;
  onRunQueue: () => void;
  onSmartMerge: (id: string) => void;
  onCopyTrainPlan: (text: string, count: number) => void;
}

type QueuePhase = "queued" | "ready" | "work" | "blocked";

interface QueueItem {
  pr: PullRequestSummary;
  branch?: BranchSummary;
  actionState: PullRequestActionState;
  phase: QueuePhase;
  readiness: number;
  readinessTotal: number;
  blockers: string[];
  eta: string;
  memoryDecision: string;
  queuedAt?: string;
}

const phases: Array<{ id: QueuePhase; label: string }> = [
  { id: "queued", label: "Queued" },
  { id: "ready", label: "Ready" },
  { id: "work", label: "Needs work" },
  { id: "blocked", label: "Blocked" },
];

export function MergeQueueTimeline({
  pullRequests,
  branches,
  reviewMemory,
  mergeQueue,
  selectedId,
  onSelectPullRequest,
  onRunQueue,
  onSmartMerge,
  onCopyTrainPlan,
}: MergeQueueTimelineProps) {
  const queue = buildQueue(pullRequests, branches, reviewMemory, mergeQueue);
  const selected = queue.find((item) => item.pr.id === selectedId) ?? queue[0];
  const queuedCount = queue.filter((item) => item.phase === "queued").length;
  const readyCount = queue.filter((item) => item.phase === "ready").length;
  const blockedCount = queue.filter((item) => item.phase === "blocked").length;
  const trainEta = queuedCount ? `${Math.max(4, queuedCount * 3)}m` : readyCount ? `${Math.max(6, readyCount * 4)}m` : "waiting";
  const plan = formatMergeTrainPlan(queue);

  return (
    <section className="merge-queue-timeline" id="merge-queue-timeline" data-testid="merge-queue-timeline">
      <div className="queue-timeline-head">
        <div>
          <span>Merge train</span>
          <h2>{queuedCount ? `${queuedCount} PRs staged for departure` : `${readyCount} PRs ready to stage`}</h2>
          <p>{blockedCount} blocked by CI, review, draft, branch drift, or a local queue decision.</p>
        </div>
        <div className="queue-train-actions">
          <button type="button" className="queue-plan-button" onClick={() => onCopyTrainPlan(plan, queue.length)}>
            <Copy size={15} />
            <span>Copy plan</span>
          </button>
          <button type="button" onClick={onRunQueue}>
            <Play size={15} />
            <span>Run train</span>
            <kbd>{trainEta}</kbd>
          </button>
        </div>
      </div>

      <div className="queue-stage-rail" aria-label="Merge queue stages">
        {phases.map((phase) => {
          const items = queue.filter((item) => item.phase === phase.id);
          return (
            <button
              type="button"
              key={phase.id}
              className={`queue-stage stage-${phase.id}`}
              onClick={() => items[0] && onSelectPullRequest(items[0].pr.id)}
            >
              <span>{phase.label}</span>
              <strong>{items.length}</strong>
              <small>{items.slice(0, 3).map((item) => `#${item.pr.number}`).join(" ") || "clear"}</small>
            </button>
          );
        })}
      </div>

      <div className="queue-timeline-body">
        <div className="train-order">
          <div className="queue-panel-title">
            <GitMerge size={15} />
            <strong>Departure order</strong>
            <span>{queue.length} active</span>
          </div>
          <div className="train-list">
            {queue.slice(0, 7).map((item, index) => (
              <button
                type="button"
                key={item.pr.id}
                className={`train-row phase-${item.phase} ${item.pr.id === selected?.pr.id ? "selected" : ""}`}
                onClick={() => onSelectPullRequest(item.pr.id)}
              >
                <span className="train-index">{index + 1}</span>
                <span className="train-copy">
                  <strong>#{item.pr.number} {item.pr.title}</strong>
                  <small>{trainRowDetail(item)}</small>
                </span>
                <span className={`queue-kicker ${item.phase}`}>{phaseLabel(item.phase)}</span>
                <span className="train-readiness">{item.readiness}/{item.readinessTotal}</span>
                <span className="train-eta">{item.eta}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="gate-matrix">
          <div className="queue-panel-title">
            <ShieldCheck size={15} />
            <strong>Selected gates</strong>
            <span>{selected ? `#${selected.pr.number}` : "none"}</span>
          </div>
          {selected && (
            <div className="gate-list">
              <GateRow label="Queue state" ready={selected.phase === "queued" || selected.phase === "ready"} detail={phaseLabel(selected.phase)} />
              <GateRow label="CI checks" ready={selected.pr.ci === "success"} detail={selected.pr.ciSummary} />
              <GateRow label="Review state" ready={selected.actionState.hasReadySignal} detail={selected.pr.state.replace("_", " ")} />
              <GateRow label="Branch drift" ready={selected.actionState.branchClean} detail={branchDetail(selected)} />
              <GateRow label="Your decision" ready={selected.memoryDecision === "ready"} detail={selected.memoryDecision} />
            </div>
          )}
        </div>

        <div className="blocker-board">
          <div className="queue-panel-title">
            <AlertCircle size={15} />
            <strong>Blocker board</strong>
            <span>{blockedCount} hot</span>
          </div>
          <div className="blocker-list">
            {queue.filter((item) => item.blockers.length).slice(0, 5).map((item) => (
              <button type="button" key={item.pr.id} onClick={() => onSelectPullRequest(item.pr.id)}>
                <GitPullRequest size={14} />
                <span>#{item.pr.number}</span>
                <strong>{item.blockers[0]}</strong>
                <StatusPill state={item.pr.state} />
              </button>
            ))}
            {!blockedCount && (
              <div className="blocker-empty">
                <CheckCircle2 size={16} />
                All queue gates are clear.
              </div>
            )}
          </div>
          {selected && (
            <button className="queue-merge-button" onClick={() => onSmartMerge(selected.pr.id)} disabled={!selected.actionState.canQueueMerge}>
              <GitMerge size={15} />
              Queue selected PR
              <CiBadge state={selected.pr.ci} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function GateRow({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return (
    <div className={ready ? "gate-row ready" : "gate-row blocked"}>
      {ready ? <MiniCheck /> : <Clock3 size={15} />}
      <span>{label}</span>
      <em>{detail}</em>
    </div>
  );
}

function buildQueue(
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  reviewMemory: ReviewMemoryByPr,
  mergeQueue: MergeQueueMemory,
) {
  const queuedOrder = new Map(mergeQueue.queuedPrIds.map((id, index) => [id, index]));

  return pullRequests
    .map((pr, index) => buildQueueItem(pr, index, branches, reviewMemory, mergeQueue, queuedOrder))
    .sort((a, b) => {
      const phaseWeight = phaseScore(a.phase) - phaseScore(b.phase);
      if (phaseWeight !== 0) return phaseWeight;
      const queuedA = queuedOrder.get(a.pr.id) ?? Number.MAX_SAFE_INTEGER;
      const queuedB = queuedOrder.get(b.pr.id) ?? Number.MAX_SAFE_INTEGER;
      if (queuedA !== queuedB) return queuedA - queuedB;
      return b.readiness - a.readiness || new Date(b.pr.updatedAt).getTime() - new Date(a.pr.updatedAt).getTime();
    });
}

function buildQueueItem(
  pr: PullRequestSummary,
  index: number,
  branches: BranchSummary[],
  memoryByPr: ReviewMemoryByPr,
  mergeQueue: MergeQueueMemory,
  queuedOrder: Map<string, number>,
): QueueItem {
  const intel = getPrIntelligence(pr, index);
  const memory = memoryByPr[pr.id];
  const branch = findBranchForPullRequest(branches, pr);
  const actionState = getPullRequestActionState(pr, branch, memory);
  const snoozed = Boolean(memory?.snoozedUntil && new Date(memory.snoozedUntil).getTime() > Date.now());
  const queuedAt = mergeQueue.queuedAtByPr[pr.id];
  const localBlock = mergeQueue.blockedByPr[pr.id];
  const gateBlock = isWorkReason(actionState.blockedReason) ? "" : actionState.blockedReason ?? "";
  const blockers = [
    localBlock ?? "",
    gateBlock,
    snoozed ? "Snoozed from review queue." : "",
    memory?.decision === "blocked" ? "Blocked by your local decision." : "",
  ].filter(uniqueTruthy);
  const memoryDecision = memory?.decision ?? "watch";
  const phase = pickQueuePhase(Boolean(queuedAt || queuedOrder.has(pr.id)), actionState, blockers, memoryDecision);

  return {
    pr,
    branch,
    actionState,
    phase,
    readiness: intel.readiness,
    readinessTotal: intel.readinessTotal,
    blockers,
    eta: phase === "queued" ? `${Math.max(2, 5 + (queuedOrder.get(pr.id) ?? index) * 2)}m` : intel.queueEstimate,
    memoryDecision,
    queuedAt,
  };
}

function pickQueuePhase(
  queued: boolean,
  actionState: PullRequestActionState,
  blockers: string[],
  memoryDecision: string,
): QueuePhase {
  if (blockers.length) return "blocked";
  if (queued && actionState.canQueueMerge) return "queued";
  if (actionState.canQueueMerge) return "ready";
  if (memoryDecision === "blocked") return "blocked";
  return "work";
}

function uniqueTruthy(value: string, index: number, values: string[]) {
  return Boolean(value) && values.indexOf(value) === index;
}

function phaseScore(phase: QueuePhase) {
  if (phase === "queued") return 1;
  if (phase === "ready") return 2;
  if (phase === "work") return 3;
  return 4;
}

function phaseLabel(phase: QueuePhase) {
  if (phase === "queued") return "Queued";
  if (phase === "ready") return "Ready";
  if (phase === "work") return "Needs work";
  return "Blocked";
}

function trainRowDetail(item: QueueItem) {
  if (item.queuedAt) return `queued ${formatRelativeTime(item.queuedAt)} - ${item.pr.branch}`;
  if (item.blockers[0]) return `${item.blockers[0]} - updated ${formatRelativeTime(item.pr.updatedAt)}`;
  if (item.actionState.blockedReason) return `${item.actionState.blockedReason} - updated ${formatRelativeTime(item.pr.updatedAt)}`;
  return `${item.memoryDecision} - updated ${formatRelativeTime(item.pr.updatedAt)}`;
}

function isWorkReason(reason?: string) {
  return Boolean(reason?.startsWith("Needs approval"));
}

function branchDetail(item: QueueItem) {
  if (!item.branch) return "unknown";
  return `${item.branch.ahead} ahead / ${item.branch.behind} behind ${item.pr.base}`;
}

function formatMergeTrainPlan(queue: QueueItem[]) {
  const queued = queue.filter((item) => item.phase === "queued");
  const ready = queue.filter((item) => item.phase === "ready");
  const blocked = queue.filter((item) => item.phase === "blocked");
  const lead = queued.length ? queued : ready;

  return [
    "Merge train plan",
    `Generated ${new Date().toLocaleString()}`,
    "",
    lead.length ? "Departure order:" : "No PRs are ready to depart.",
    ...lead.map((item, index) => `${index + 1}. #${item.pr.number} ${item.pr.title} - ${branchDetail(item)} - ${item.pr.ciSummary}`),
    "",
    blocked.length ? "Blockers:" : "Blockers: none",
    ...blocked.slice(0, 8).map((item) => `- #${item.pr.number}: ${item.blockers[0] ?? "blocked"}`),
  ].join("\n");
}
