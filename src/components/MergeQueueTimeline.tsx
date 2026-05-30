import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  GitMerge,
  GitPullRequest,
  Play,
  ShieldCheck,
} from "lucide-react";
import { PullRequestSummary, ReviewMemoryByPr } from "../types";
import { getPrIntelligence } from "../lib/insights";
import { CiBadge, formatRelativeTime, MiniCheck, StatusPill } from "./ui";

interface MergeQueueTimelineProps {
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  selectedId?: string;
  onSelectPullRequest: (id: string) => void;
  onRunQueue: () => void;
  onSmartMerge: (id: string) => void;
}

type QueuePhase = "intake" | "review" | "checks" | "queued" | "blocked";

interface QueueItem {
  pr: PullRequestSummary;
  phase: QueuePhase;
  readiness: number;
  readinessTotal: number;
  blockers: string[];
  eta: string;
  memoryDecision: string;
}

const phases: Array<{ id: QueuePhase; label: string }> = [
  { id: "intake", label: "Intake" },
  { id: "review", label: "Review" },
  { id: "checks", label: "Checks" },
  { id: "queued", label: "Queued" },
];

export function MergeQueueTimeline({
  pullRequests,
  reviewMemory,
  selectedId,
  onSelectPullRequest,
  onRunQueue,
  onSmartMerge,
}: MergeQueueTimelineProps) {
  const queue = pullRequests
    .map((pr, index) => buildQueueItem(pr, index, reviewMemory))
    .sort((a, b) => {
      const phaseWeight = phaseScore(b.phase) - phaseScore(a.phase);
      if (phaseWeight !== 0) return phaseWeight;
      return b.readiness - a.readiness;
    });
  const selected = queue.find((item) => item.pr.id === selectedId) ?? queue[0];
  const readyCount = queue.filter((item) => item.phase === "queued").length;
  const blockedCount = queue.filter((item) => item.phase === "blocked").length;
  const trainEta = readyCount ? `${Math.max(4, readyCount * 3)}m` : "waiting";

  return (
    <section className="merge-queue-timeline" id="merge-queue-timeline" data-testid="merge-queue-timeline">
      <div className="queue-timeline-head">
        <div>
          <span>Merge train</span>
          <h2>{readyCount} PRs ready for the next departure</h2>
          <p>{blockedCount} blocked by review gates, memory decisions, or CI.</p>
        </div>
        <button onClick={onRunQueue}>
          <Play size={15} />
          <span>Run train</span>
          <kbd>{trainEta}</kbd>
        </button>
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
            <strong>Next merge order</strong>
            <span>{queue.length} active</span>
          </div>
          <div className="train-list">
            {queue.slice(0, 6).map((item, index) => (
              <button
                type="button"
                key={item.pr.id}
                className={`train-row phase-${item.phase} ${item.pr.id === selected?.pr.id ? "selected" : ""}`}
                onClick={() => onSelectPullRequest(item.pr.id)}
              >
                <span className="train-index">{index + 1}</span>
                <span className="train-copy">
                  <strong>#{item.pr.number} {item.pr.title}</strong>
                  <small>{item.memoryDecision} · updated {formatRelativeTime(item.pr.updatedAt)}</small>
                </span>
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
              <GateRow label="CI checks" ready={selected.pr.ci === "success"} detail={selected.pr.ciSummary} />
              <GateRow label="Review state" ready={selected.pr.state === "approved" || selected.pr.reviewers.length > 0} detail={selected.pr.state.replace("_", " ")} />
              <GateRow label="Codex signal" ready={selected.pr.codex.exists} detail={selected.pr.codex.statusText} />
              <GateRow label="Your decision" ready={selected.memoryDecision === "ready"} detail={selected.memoryDecision} />
              <GateRow label="Stack health" ready={selected.blockers.length === 0} detail={selected.blockers[0] ?? "clear"} />
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
            {queue.filter((item) => item.blockers.length).slice(0, 4).map((item) => (
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
            <button className="queue-merge-button" onClick={() => onSmartMerge(selected.pr.id)}>
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

function buildQueueItem(pr: PullRequestSummary, index: number, memoryByPr: ReviewMemoryByPr): QueueItem {
  const intel = getPrIntelligence(pr, index);
  const memory = memoryByPr[pr.id];
  const snoozed = Boolean(memory?.snoozedUntil && new Date(memory.snoozedUntil).getTime() > Date.now());
  const blockers = [
    pr.isDraft ? "draft PR" : "",
    pr.ci === "failure" ? "CI failing" : "",
    pr.ci === "pending" ? "checks pending" : "",
    pr.state === "changes_requested" ? "changes requested" : "",
    pr.reviewers.length === 0 ? "needs reviewer" : "",
    !pr.codex.exists ? "Codex missing" : "",
    memory?.decision === "blocked" ? "manual block" : "",
    snoozed ? "snoozed" : "",
  ].filter(Boolean);
  const memoryDecision = memory?.decision ?? "watch";
  const readyByDecision = memoryDecision === "ready";
  const readyBySignals = intel.readiness >= intel.readinessTotal - 1 && pr.ci === "success";
  const phase = blockers.length
    ? "blocked"
    : readyByDecision || readyBySignals || pr.state === "approved"
      ? "queued"
      : pr.state === "waiting_review"
        ? "review"
        : pr.ci === "pending"
          ? "checks"
          : "intake";

  return {
    pr,
    phase,
    readiness: intel.readiness,
    readinessTotal: intel.readinessTotal,
    blockers,
    eta: phase === "queued" ? `${Math.max(2, 7 - index)}m` : intel.queueEstimate,
    memoryDecision,
  };
}

function phaseScore(phase: QueuePhase) {
  if (phase === "queued") return 5;
  if (phase === "checks") return 4;
  if (phase === "review") return 3;
  if (phase === "intake") return 2;
  return 1;
}
