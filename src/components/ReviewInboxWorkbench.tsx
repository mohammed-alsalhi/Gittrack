import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileCode2,
  GitBranch,
  GitMerge,
  GitPullRequest,
  ListChecks,
  Radar,
  Sparkles,
  ThumbsUp,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { getPrIntelligence, type PrIntelligence } from "../lib/insights";
import type { PullRequestActionState } from "../lib/prActions";
import type { PullRequestSummary, ReviewMemory, ReviewMemoryByPr } from "../types";
import { AvatarStack, CiBadge, CodexBadge, formatRelativeTime, StatusPill } from "./ui";

interface ReviewInboxWorkbenchProps {
  pullRequests: PullRequestSummary[];
  selectedId?: string;
  reviewMemory: ReviewMemoryByPr;
  actionStates?: Record<string, PullRequestActionState>;
  onSelectPullRequest: (id: string) => void;
  onPromoteCodex: (id: string) => void;
  onMarkReady: (id: string) => void;
  onSmartMerge: (id: string) => void;
  onSelectNext: () => void;
  onSelectPrevious: () => void;
  onCopySessionBrief: (text: string, count: number) => void;
  onOpenStackReviewNavigator: () => void;
  onOpenChangeRadar: () => void;
}

interface QueueItem {
  pr: PullRequestSummary;
  intel: PrIntelligence;
  memory?: ReviewMemory;
  reason: string;
  tone: "green" | "amber" | "red" | "purple" | "blue";
  score: number;
}

export function ReviewInboxWorkbench({
  pullRequests,
  selectedId,
  reviewMemory,
  actionStates = {},
  onSelectPullRequest,
  onPromoteCodex,
  onMarkReady,
  onSmartMerge,
  onSelectNext,
  onSelectPrevious,
  onCopySessionBrief,
  onOpenStackReviewNavigator,
  onOpenChangeRadar,
}: ReviewInboxWorkbenchProps) {
  const queueItems = useMemo(
    () =>
      pullRequests
        .map((pr, index) => {
          const intel = getPrIntelligence(pr, index);
          const memory = reviewMemory[pr.id];
          return {
            pr,
            intel,
            memory,
            ...getReviewSignal(pr, intel, memory),
          };
        })
        .sort((a, b) => b.score - a.score || new Date(b.pr.updatedAt).getTime() - new Date(a.pr.updatedAt).getTime()),
    [pullRequests, reviewMemory],
  );
  const sessionBrief = useMemo(() => buildSessionBrief(queueItems), [queueItems]);

  const selectedItem =
    queueItems.find((item) => item.pr.id === selectedId) ??
    queueItems[0];
  const selectedPr = selectedItem?.pr;
  const selectedIntel = selectedItem?.intel;
  const selectedMemory = selectedItem?.memory;
  const selectedActionState = selectedPr ? actionStates[selectedPr.id] : undefined;
  const readyPercent =
    selectedIntel === undefined
      ? 0
      : Math.round((selectedIntel.readiness / selectedIntel.readinessTotal) * 100);
  const metrics = selectedPr && selectedIntel
    ? [
        { label: "Risk", value: selectedIntel.risk, tone: selectedIntel.risk },
        { label: "Queue", value: selectedIntel.queueEstimate, tone: "blue" },
        { label: "Files", value: String(selectedIntel.files.length), tone: "purple" },
        { label: "Ready", value: `${selectedIntel.readiness}/${selectedIntel.readinessTotal}`, tone: "green" },
      ]
    : [];
  const topQueue = queueItems.slice(0, 4);
  const visibleQueue =
    selectedItem && !topQueue.some((item) => item.pr.id === selectedItem.pr.id)
      ? [selectedItem, ...queueItems.filter((item) => item.pr.id !== selectedItem.pr.id).slice(0, 3)]
      : topQueue;

  return (
    <section className="review-inbox-workbench" id="review-inbox-workbench" data-testid="review-inbox-workbench">
      <div className="review-inbox-head">
        <div>
          <span>Review inbox</span>
          <h2>Next review loop</h2>
        </div>
        <div className="review-inbox-actions">
          <button type="button" onClick={onOpenChangeRadar}>
            <Radar size={14} />
            Change radar
          </button>
          <button type="button" onClick={onOpenStackReviewNavigator}>
            <GitBranch size={14} />
            Stack review
          </button>
        </div>
      </div>

      <div className="review-session-strip" data-testid="review-session-brief">
        <div className="review-session-copy">
          <span>Session brief</span>
          <strong>{sessionBrief.headline}</strong>
          <small>{sessionBrief.openingMove}</small>
        </div>
        <div className="review-session-metrics" aria-label="Review session metrics">
          {sessionBrief.metrics.map((metric) => (
            <div className={`review-session-metric metric-${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => onCopySessionBrief(sessionBrief.copy, queueItems.length)}>
          <Copy size={14} />
          Copy brief
        </button>
      </div>

      <div className="review-inbox-grid">
        <aside className="review-queue-panel">
          <div className="review-section-title">
            <span>Queue</span>
            <strong>{queueItems.length} PRs</strong>
          </div>

          <div className="review-queue-list">
            {visibleQueue.map((item) => (
              <button
                type="button"
                className={[
                  "review-queue-item",
                  item.pr.id === selectedPr?.id ? "selected" : "",
                  `signal-${item.tone}`,
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={item.pr.id}
                onClick={() => onSelectPullRequest(item.pr.id)}
                data-testid={`review-inbox-pr-${item.pr.id}`}
              >
                <span className="review-queue-number">#{item.pr.number}</span>
                <span className="review-queue-copy">
                  <strong>{item.pr.title}</strong>
                  <small>
                    {item.pr.author.login} · {formatRelativeTime(item.pr.updatedAt)}
                  </small>
                </span>
                <span className="review-queue-reason">{item.reason}</span>
              </button>
            ))}

            {!visibleQueue.length && (
              <div className="review-queue-empty">
                <CheckCircle2 size={18} />
                <strong>Inbox cleared</strong>
                <span>No pull requests match this repository and filter.</span>
              </div>
            )}
          </div>
        </aside>

        <div className="review-focus-panel">
          {selectedPr && selectedIntel ? (
            <>
              <div className="review-focus-title">
                <div>
                  <span>{selectedPr.repo}</span>
                  <h3>{selectedPr.title}</h3>
                </div>
                <div className="review-focus-badges">
                  <StatusPill state={selectedPr.state} />
                  <CiBadge state={selectedPr.ci} />
                  <CodexBadge reaction={selectedPr.codex.reaction} />
                </div>
              </div>

              <div className="review-branch-route">
                <span>{selectedPr.branch}</span>
                <ArrowRight size={13} />
                <span>{selectedPr.base}</span>
                {selectedPr.url && (
                  <a href={selectedPr.url} target="_blank" rel="noreferrer" title="Open pull request">
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>

              <div className="review-focus-metrics">
                {metrics.map((metric) => (
                  <div className={`review-focus-metric metric-${metric.tone}`} key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </div>
                ))}
              </div>

              <div className="review-readiness-card">
                <div>
                  <span>Merge readiness</span>
                  <strong>{readyPercent}%</strong>
                </div>
                <div className="review-readiness-track">
                  <span style={{ "--ready": `${readyPercent}%` } as CSSProperties} />
                </div>
              </div>

              <div className="review-focus-columns">
                <div className="review-file-list">
                  <div className="review-section-title">
                    <span>Files to scan</span>
                    <strong>{selectedIntel.files.length}</strong>
                  </div>
                  {selectedIntel.files.slice(0, 4).map((file) => (
                    <span key={file}>
                      <FileCode2 size={14} />
                      {file}
                    </span>
                  ))}
                </div>

                <div className="review-route-list">
                  <div className="review-section-title">
                    <span>Review route</span>
                    <strong>{getNextAction(selectedPr, selectedIntel, selectedMemory)}</strong>
                  </div>
                  <ReviewRouteItem ready={selectedPr.ci === "success"} label="CI checks passing" />
                  <ReviewRouteItem ready={selectedPr.codex.reaction === "thumbs_up" || selectedPr.codex.reaction === "changed"} label="Codex signal clean" />
                  <ReviewRouteItem ready={!selectedPr.isDraft} label="Ready for merge queue" />
                </div>
              </div>
            </>
          ) : (
            <div className="review-focus-empty">
              <GitPullRequest size={24} />
              <strong>Select a pull request</strong>
              <span>Your next review will appear here.</span>
            </div>
          )}
        </div>

        <aside className="review-command-panel">
          <div className="review-section-title">
            <span>Commands</span>
            <strong>{selectedItem?.reason ?? "Idle"}</strong>
          </div>

          <div className="review-shortcuts" aria-label="Keyboard review shortcuts">
            <button type="button" onClick={onSelectPrevious}>
              <kbd>K</kbd>
              <span>Previous</span>
            </button>
            <button type="button" onClick={onSelectNext}>
              <kbd>J</kbd>
              <span>Next</span>
            </button>
            <span>
              <kbd>A</kbd>
              <span>AI</span>
            </span>
            <span>
              <kbd>R</kbd>
              <span>Ready</span>
            </span>
            <span>
              <kbd>M</kbd>
              <span>Merge</span>
            </span>
          </div>

          <div className="review-command-card">
            <span className={`review-command-signal signal-${selectedItem?.tone ?? "blue"}`}>
              {signalIcon(selectedItem?.tone)}
            </span>
            <strong>{selectedPr ? getNextAction(selectedPr, selectedIntel, selectedMemory) : "Pick a PR"}</strong>
            <p>{selectedPr ? commandCopy(selectedPr, selectedIntel, selectedMemory) : "Choose a queue item to unlock review commands."}</p>
          </div>

          <div className="review-command-buttons">
            <button
              type="button"
              disabled={!selectedPr || selectedActionState?.canPromoteCodex === false}
              onClick={() => selectedPr && onPromoteCodex(selectedPr.id)}
              data-testid="review-workbench-promote-ai"
            >
              <Sparkles size={14} />
              Promote AI
              <kbd>A</kbd>
            </button>
            <button
              type="button"
              disabled={!selectedPr || selectedActionState?.canMarkReady === false}
              onClick={() => selectedPr && onMarkReady(selectedPr.id)}
              data-testid="review-workbench-mark-ready"
            >
              <ThumbsUp size={14} />
              Mark ready
              <kbd>R</kbd>
            </button>
            <button
              type="button"
              disabled={!selectedPr || selectedActionState?.canQueueMerge === false}
              onClick={() => selectedPr && onSmartMerge(selectedPr.id)}
              data-testid="review-workbench-smart-merge"
            >
              <GitMerge size={14} />
              Smart merge
              <kbd>M</kbd>
            </button>
          </div>

          <div className="review-command-reviewers">
            <span>Reviewers</span>
            {selectedPr ? <AvatarStack people={selectedPr.reviewers} /> : <small>-</small>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function ReviewRouteItem({ ready, label }: { ready: boolean; label: string }) {
  return (
    <span className={ready ? "ready" : "waiting"}>
      {ready ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
      {label}
    </span>
  );
}

function getReviewSignal(
  pr: PullRequestSummary,
  intel: PrIntelligence,
  memory?: ReviewMemory,
): Pick<QueueItem, "reason" | "score" | "tone"> {
  if (memory?.pinned) return { reason: "Pinned", score: 92, tone: "blue" };
  if (pr.ci === "failure") return { reason: "CI failing", score: 88, tone: "red" };
  if (pr.state === "changes_requested") return { reason: "Changes requested", score: 84, tone: "red" };
  if (!pr.codex.exists || pr.codex.reaction === "eyes") return { reason: "Codex pending", score: 72, tone: "amber" };
  if (intel.risk === "high") return { reason: "High risk", score: 68, tone: "red" };
  if (pr.isDraft) return { reason: "Draft stack", score: 54, tone: "purple" };
  if (intel.readiness >= intel.readinessTotal - 1) return { reason: "Merge-ready", score: 50, tone: "green" };
  return { reason: "Needs review", score: 42, tone: "blue" };
}

function buildSessionBrief(queueItems: QueueItem[]) {
  const blockers = queueItems.filter(
    (item) =>
      item.pr.ci === "failure" ||
      item.pr.state === "changes_requested" ||
      item.intel.risk === "high",
  );
  const aiGaps = queueItems.filter((item) => !item.pr.codex.exists || item.pr.codex.reaction === "eyes");
  const mergeReady = queueItems.filter(
    (item) =>
      item.intel.readiness >= item.intel.readinessTotal - 1 &&
      item.pr.ci === "success" &&
      !item.pr.isDraft,
  );
  const total = queueItems.length;
  const sessionMinutes = Math.max(
    8,
    blockers.length * 7 +
      aiGaps.length * 4 +
      mergeReady.length * 3 +
      Math.max(0, total - blockers.length - aiGaps.length - mergeReady.length) * 5,
  );
  const first = queueItems[0];
  const headline = total
    ? `${total} PR review loop · ${sessionMinutes}m`
    : "Inbox clear";
  const openingMove = first
    ? `Start with #${first.pr.number}: ${getNextAction(first.pr, first.intel, first.memory)}.`
    : "No queued pull requests in this view.";
  const blockerList = blockers.slice(0, 3).map((item) => `#${item.pr.number} ${item.pr.title}`).join("; ") || "None";
  const aiList = aiGaps.slice(0, 3).map((item) => `#${item.pr.number} ${item.pr.title}`).join("; ") || "None";
  const readyList = mergeReady.slice(0, 3).map((item) => `#${item.pr.number} ${item.pr.title}`).join("; ") || "None";
  const copy = [
    `Review session (${total} PRs, ~${sessionMinutes}m)`,
    openingMove,
    `Blockers: ${blockerList}`,
    `AI gaps: ${aiList}`,
    `Merge-ready: ${readyList}`,
  ].join("\n");

  return {
    headline,
    openingMove,
    copy,
    metrics: [
      { label: "Blockers", value: String(blockers.length), tone: blockers.length ? "red" : "green" },
      { label: "AI gaps", value: String(aiGaps.length), tone: aiGaps.length ? "amber" : "green" },
      { label: "Ready", value: String(mergeReady.length), tone: "green" },
      { label: "Loop", value: `${sessionMinutes}m`, tone: "blue" },
    ],
  };
}

function getNextAction(
  pr: PullRequestSummary,
  intel?: PrIntelligence,
  memory?: ReviewMemory,
) {
  if (memory?.decision === "blocked") return "Unblock review";
  if (pr.ci === "failure") return "Fix failing checks";
  if (pr.state === "changes_requested") return "Resolve feedback";
  if (!pr.codex.exists || pr.codex.reaction === "eyes") return "Run AI review";
  if (intel && intel.readiness >= intel.readinessTotal - 1 && !pr.isDraft) return "Queue merge";
  if (pr.isDraft) return "Review draft stack";
  return "Review diff";
}

function commandCopy(
  pr: PullRequestSummary,
  intel?: PrIntelligence,
  memory?: ReviewMemory,
) {
  const action = getNextAction(pr, intel, memory);
  if (action === "Run AI review") return "Codex is still at eyes or missing. Promote the signal once it has a thumbs-up review.";
  if (action === "Queue merge") return "The PR is close to green. Mark it ready, then push it through the smart merge path.";
  if (action === "Fix failing checks") return "Prioritize CI before reviewing more files so the queue stays trustworthy.";
  if (action === "Resolve feedback") return "Requested changes are blocking this stack. Open the review thread and clear the feedback loop.";
  return "Scan the touched files, confirm readiness, then move the PR to the next queue state.";
}

function signalIcon(tone?: QueueItem["tone"]) {
  if (tone === "red") return <AlertTriangle size={15} />;
  if (tone === "green") return <CheckCircle2 size={15} />;
  if (tone === "amber") return <Bot size={15} />;
  if (tone === "purple") return <ListChecks size={15} />;
  return <GitPullRequest size={15} />;
}
