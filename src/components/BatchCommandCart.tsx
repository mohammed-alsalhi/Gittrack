import { useMemo } from "react";
import {
  Bot,
  CheckCircle2,
  Clipboard,
  GitMerge,
  GitPullRequest,
  RadioTower,
  ShieldAlert,
  Sparkles,
  Target,
  TimerReset,
  X,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import type { BatchExecutionMemory, BatchExecutionMode, PullRequestSummary, ReviewMemoryByPr } from "../types";
import { CiBadge, CodexBadge, formatRelativeTime, StatusPill } from "./ui";

interface BatchCommandCartProps {
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  memory: BatchExecutionMemory;
  onModeChange: (mode: BatchExecutionMode) => void;
  onTogglePullRequest: (id: string, selected: boolean) => void;
  onSelectRecommended: (ids: string[]) => void;
  onClearSelection: () => void;
  onRunBatch: (mode: BatchExecutionMode, ids: string[]) => void;
  onCopyBatch: (text: string, count: number) => void;
  onOpenPullRequest: (repo: string, id: string) => void;
}

interface BatchModeConfig {
  id: BatchExecutionMode;
  label: string;
  detail: string;
  action: string;
  icon: LucideIcon;
  tone: BatchTone;
}

type BatchTone = "blue" | "green" | "amber" | "red" | "purple";

interface BatchCandidate {
  pr: PullRequestSummary;
  score: number;
  reason: string;
  readiness: string;
  risk: "low" | "medium" | "high";
}

const batchModes: BatchModeConfig[] = [
  {
    id: "ship",
    label: "Ship",
    detail: "Mark green work ready for the train.",
    action: "Mark ready",
    icon: GitMerge,
    tone: "green",
  },
  {
    id: "review",
    label: "Review",
    detail: "Pin waiting PRs into a focused run.",
    action: "Pin review",
    icon: Target,
    tone: "amber",
  },
  {
    id: "ai",
    label: "AI",
    detail: "Promote missing Codex coverage.",
    action: "Promote AI",
    icon: Bot,
    tone: "purple",
  },
  {
    id: "unblock",
    label: "Unblock",
    detail: "Escalate failures and requested changes.",
    action: "Mark blocked",
    icon: ShieldAlert,
    tone: "red",
  },
];

export function BatchCommandCart({
  pullRequests,
  reviewMemory,
  memory,
  onModeChange,
  onTogglePullRequest,
  onSelectRecommended,
  onClearSelection,
  onRunBatch,
  onCopyBatch,
  onOpenPullRequest,
}: BatchCommandCartProps) {
  const candidatesByMode = useMemo(
    () => buildBatchCandidates(pullRequests, reviewMemory),
    [pullRequests, reviewMemory],
  );
  const modeConfig = batchModes.find((mode) => mode.id === memory.mode) ?? batchModes[0];
  const candidates = candidatesByMode[memory.mode];
  const selectedSet = new Set(memory.selectedPrIds);
  const selected = memory.selectedPrIds
    .map((id) => pullRequests.find((pr) => pr.id === id))
    .filter((pr): pr is PullRequestSummary => Boolean(pr));
  const selectedInsights = selected.map((pr, index) => ({ pr, intel: getPrIntelligence(pr, index) }));
  const totalFiles = new Set(selectedInsights.flatMap(({ intel }) => intel.files)).size;
  const highRiskCount = selectedInsights.filter(({ intel, pr }) => intel.risk === "high" || pr.ci === "failure").length;
  const aiGapCount = selected.filter((pr) => !pr.codex.exists || pr.codex.reaction === "eyes").length;
  const readyCount = selectedInsights.filter(({ pr, intel }) => {
    const memoryForPr = reviewMemory[pr.id];
    return (
      pr.ci === "success" &&
      !pr.isDraft &&
      memoryForPr?.decision !== "blocked" &&
      (memoryForPr?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1)
    );
  }).length;
  const recommendedIds = candidates.slice(0, 5).map((candidate) => candidate.pr.id);
  const batchText = formatBatchPlan(memory.mode, selected, reviewMemory);

  return (
    <section className="batch-cart" id="batch-command-cart" data-testid="batch-command-cart">
      <div className="batch-head">
        <div>
          <span>Batch command cart</span>
          <h2>{selected.length ? `${formatCount(selected.length, "PR")} staged for ${modeConfig.label.toLowerCase()}` : "Build a multi-PR command run"}</h2>
          <p>Select a set once, preview the blast radius, then apply review, AI, unblock, or ship decisions in one move.</p>
        </div>
        <div className="batch-actions">
          <button type="button" onClick={() => onSelectRecommended(recommendedIds)} data-testid="batch-select-recommended">
            <Sparkles size={14} />
            Recommended
          </button>
          <button type="button" onClick={() => onCopyBatch(batchText, selected.length)}>
            <Clipboard size={14} />
            Copy plan
          </button>
          <button type="button" onClick={onClearSelection}>
            <X size={14} />
            Clear
          </button>
        </div>
      </div>

      <div className="batch-metrics" aria-label="Batch metrics">
        <BatchMetric label="Selected" value={selected.length} detail={formatCount(candidates.length, "candidate")} tone={selected.length ? modeConfig.tone : "blue"} icon={GitPullRequest} />
        <BatchMetric label="Ready now" value={readyCount} detail="green lane" tone={readyCount ? "green" : "blue"} icon={GitMerge} />
        <BatchMetric label="Risk flags" value={highRiskCount} detail="needs eyes" tone={highRiskCount ? "red" : "green"} icon={ShieldAlert} />
        <BatchMetric label="Files touched" value={totalFiles} detail={`${aiGapCount} AI gaps`} tone={aiGapCount ? "purple" : "green"} icon={RadioTower} />
      </div>

      <div className="batch-mode-tabs" role="tablist" aria-label="Batch mode">
        {batchModes.map((mode) => {
          const Icon = mode.icon;
          const count = candidatesByMode[mode.id].length;

          return (
            <button
              type="button"
              role="tab"
              aria-selected={memory.mode === mode.id}
              className={memory.mode === mode.id ? "active" : ""}
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              data-testid={`batch-mode-${mode.id}`}
            >
              <Icon size={14} />
              <span>
                <strong>{mode.label}</strong>
                <small>{mode.detail}</small>
              </span>
              <b>{count}</b>
            </button>
          );
        })}
      </div>

      <div className="batch-body">
        <div className="batch-candidates">
          <div className="batch-section-title">
            <TimerReset size={15} />
            <strong>{modeConfig.label} candidates</strong>
            <span>{candidates.length}</span>
          </div>
          <div className="batch-row-list">
            {candidates.slice(0, 8).map((candidate) => {
              const selectedCandidate = selectedSet.has(candidate.pr.id);

              return (
                <article className={`batch-row ${selectedCandidate ? "selected" : ""}`} key={candidate.pr.id}>
                  <button
                    type="button"
                    className="batch-row-toggle"
                    aria-pressed={selectedCandidate}
                    onClick={() => onTogglePullRequest(candidate.pr.id, !selectedCandidate)}
                    data-testid={`batch-toggle-${candidate.pr.number}`}
                  >
                    <span className="batch-check">
                      {selectedCandidate && <CheckCircle2 size={14} />}
                    </span>
                    <span>
                      <strong>#{candidate.pr.number} {candidate.pr.title}</strong>
                      <small>{candidate.reason} · {formatRelativeTime(candidate.pr.updatedAt)}</small>
                    </span>
                  </button>
                  <div className="batch-row-signals">
                    <StatusPill state={candidate.pr.state} />
                    <CiBadge state={candidate.pr.ci} />
                    <CodexBadge reaction={candidate.pr.codex.reaction} compact />
                    <em>{candidate.readiness}</em>
                  </div>
                  <button type="button" className="batch-open" onClick={() => onOpenPullRequest(candidate.pr.repo, candidate.pr.id)}>
                    Open
                  </button>
                </article>
              );
            })}

            {!candidates.length && (
              <div className="batch-empty">
                <CheckCircle2 size={17} />
                <strong>No candidates in this mode.</strong>
                <span>Switch modes or wait for more PR activity.</span>
              </div>
            )}
          </div>
        </div>

        <aside className="batch-preview">
          <div className="batch-section-title">
            <modeConfig.icon size={15} />
            <strong>Run preview</strong>
            <span>{modeConfig.action}</span>
          </div>
          <div className={`batch-preview-card batch-${modeConfig.tone}`}>
            <strong>{modeConfig.action} · {formatCount(selected.length, "PR")}</strong>
            <span>{selected.length ? previewLineForMode(memory.mode, selected, highRiskCount, aiGapCount) : "Select recommended candidates or choose PRs manually."}</span>
            <div className="batch-preview-stats">
              <em>{readyCount} ready</em>
              <em>{highRiskCount} risk</em>
              <em>{aiGapCount} AI gaps</em>
              <em>{totalFiles} files</em>
            </div>
            <button
              type="button"
              onClick={() => onRunBatch(memory.mode, memory.selectedPrIds)}
              disabled={!selected.length}
              data-testid="batch-run"
            >
              <modeConfig.icon size={14} />
              Run batch
            </button>
          </div>

          <div className="batch-selected-list">
            <div className="batch-section-title">
              <GitPullRequest size={15} />
              <strong>Selected PRs</strong>
              <span>{selected.length}</span>
            </div>
            {selected.slice(0, 6).map((pr) => (
              <button type="button" key={pr.id} onClick={() => onOpenPullRequest(pr.repo, pr.id)}>
                <span>
                  <strong>#{pr.number} {pr.title}</strong>
                  <small>{pr.repo} · {pr.ciSummary}</small>
                </span>
                <StatusPill state={pr.state} />
              </button>
            ))}
            {!selected.length && <p>No PRs selected yet.</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function BatchMetric({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  tone: BatchTone;
  icon: LucideIcon;
}) {
  return (
    <div className={`batch-metric metric-${tone}`}>
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function buildBatchCandidates(
  pullRequests: PullRequestSummary[],
  reviewMemory: ReviewMemoryByPr,
) {
  const lanes: Record<BatchExecutionMode, BatchCandidate[]> = {
    ship: [],
    review: [],
    ai: [],
    unblock: [],
  };

  pullRequests
    .filter((pr) => pr.state !== "merged")
    .forEach((pr, index) => {
      const intel = getPrIntelligence(pr, index);
      const memory = reviewMemory[pr.id];
      const readiness = `${intel.readiness}/${intel.readinessTotal}`;
      const snoozed = Boolean(memory?.snoozedUntil && new Date(memory.snoozedUntil).getTime() > Date.now());
      const shipReady =
        !pr.isDraft &&
        !snoozed &&
        pr.ci === "success" &&
        pr.state !== "changes_requested" &&
        memory?.decision !== "blocked" &&
        (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1);

      if (shipReady) {
        lanes.ship.push({
          pr,
          score: 92 + intel.readiness - (intel.risk === "high" ? 18 : 0),
          reason: `${pr.ciSummary}; ${intel.queueEstimate} queue`,
          readiness,
          risk: intel.risk,
        });
      }

      if (pr.state === "waiting_review" || pr.reviewers.length === 0 || pr.isDraft) {
        lanes.review.push({
          pr,
          score: 80 + (memory?.pinned ? 10 : 0) + (pr.reviewers.length ? 0 : 8),
          reason: pr.isDraft ? "draft needs a reviewable slice" : pr.reviewers.length ? `${pr.reviewers.length} reviewers assigned` : "no reviewer assigned",
          readiness,
          risk: intel.risk,
        });
      }

      if (!pr.codex.exists || pr.codex.reaction === "eyes") {
        lanes.ai.push({
          pr,
          score: pr.codex.exists ? 76 : 84,
          reason: pr.codex.statusText,
          readiness,
          risk: intel.risk,
        });
      }

      if (memory?.decision === "blocked" || pr.ci === "failure" || pr.state === "changes_requested") {
        lanes.unblock.push({
          pr,
          score: 96 + (pr.ci === "failure" ? 18 : 0) + (intel.risk === "high" ? 10 : 0),
          reason: `${pr.ciSummary}; ${pr.state.replace("_", " ")}`,
          readiness,
          risk: intel.risk,
        });
      }
    });

  Object.values(lanes).forEach((lane) =>
    lane.sort((a, b) => b.score - a.score || new Date(b.pr.updatedAt).getTime() - new Date(a.pr.updatedAt).getTime()),
  );

  return lanes;
}

function formatBatchPlan(
  mode: BatchExecutionMode,
  selected: PullRequestSummary[],
  reviewMemory: ReviewMemoryByPr,
) {
  return [
    `GitTrack batch command · ${mode}`,
    `Selected ${selected.length} ${selected.length === 1 ? "PR" : "PRs"}`,
    "",
    ...(selected.length
      ? selected.map((pr) => {
          const memory = reviewMemory[pr.id];
          return `- #${pr.number} ${pr.title} · ${pr.ciSummary} · ${memory?.decision ?? "watch"}`;
        })
      : ["No PRs selected."]),
  ].join("\n");
}

function previewLineForMode(
  mode: BatchExecutionMode,
  selected: PullRequestSummary[],
  highRiskCount: number,
  aiGapCount: number,
) {
  if (mode === "ship") return `${formatCount(selected.length, "PR")} will be marked ready with checklist gates completed.`;
  if (mode === "review") return `${formatCount(selected.length, "PR")} will be pinned into the review focus lane.`;
  if (mode === "ai") return `${formatCount(aiGapCount || selected.length, "PR")} will get Codex thumbs-up coverage.`;
  return `${formatCount(highRiskCount || selected.length, "risky PR")} will be marked blocked and pinned for unblock work.`;
}

function formatCount(count: number, label: string) {
  return `${count} ${count === 1 ? label : `${label}s`}`;
}
