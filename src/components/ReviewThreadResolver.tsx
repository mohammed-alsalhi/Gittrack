import { useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Clipboard,
  Eye,
  GitPullRequest,
  MessageSquareText,
  RadioTower,
  Send,
  ShieldAlert,
  Sparkles,
  ThumbsUp,
  TimerReset,
  X,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import type {
  PullRequestSummary,
  ReviewEvent,
  ReviewMemoryByPr,
  ReviewThreadMemoryById,
  ReviewThreadStatus,
} from "../types";
import { AvatarStack, CiBadge, CodexBadge, formatRelativeTime, StatusPill } from "./ui";

interface ReviewThreadResolverProps {
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  threadMemory: ReviewThreadMemoryById;
  selectedPrId?: string;
  onOpenPullRequest: (repo: string, id: string) => void;
  onThreadStatusChange: (threadId: string, status: ReviewThreadStatus) => void;
  onCopyThreadReply: (threadId: string, prId: string, text: string) => void;
  onPromoteCodex: (id: string) => void;
  onMarkReady: (id: string) => void;
  onMarkBlocked: (id: string) => void;
}

type ThreadFilter = "open" | "drafted" | "resolved" | "muted" | "all";
type ThreadKind = "change_request" | "comment" | "ci_failure" | "codex_gap" | "codex_shift" | "review_memory";
type ThreadTone = "blue" | "green" | "amber" | "red" | "purple";

interface ReviewThreadItem {
  id: string;
  pr: PullRequestSummary;
  kind: ThreadKind;
  status: ReviewThreadStatus;
  title: string;
  detail: string;
  reviewer: string;
  body: string;
  ageLabel: string;
  tone: ThreadTone;
  score: number;
  event?: ReviewEvent;
}

const filterOptions: Array<{ id: ThreadFilter; label: string }> = [
  { id: "open", label: "Open" },
  { id: "drafted", label: "Drafted" },
  { id: "resolved", label: "Resolved" },
  { id: "muted", label: "Muted" },
  { id: "all", label: "All" },
];

const kindConfig: Record<ThreadKind, { label: string; icon: LucideIcon; tone: ThreadTone }> = {
  change_request: { label: "Changes", icon: ShieldAlert, tone: "red" },
  comment: { label: "Comment", icon: MessageSquareText, tone: "amber" },
  ci_failure: { label: "CI", icon: TimerReset, tone: "red" },
  codex_gap: { label: "AI gap", icon: Bot, tone: "purple" },
  codex_shift: { label: "AI changed", icon: ThumbsUp, tone: "green" },
  review_memory: { label: "Decision", icon: RadioTower, tone: "blue" },
};

export function ReviewThreadResolver({
  pullRequests,
  reviewMemory,
  threadMemory,
  selectedPrId,
  onOpenPullRequest,
  onThreadStatusChange,
  onCopyThreadReply,
  onPromoteCodex,
  onMarkReady,
  onMarkBlocked,
}: ReviewThreadResolverProps) {
  const [activeFilter, setActiveFilter] = useState<ThreadFilter>("open");
  const threads = useMemo(
    () => buildReviewThreads(pullRequests, reviewMemory, threadMemory),
    [pullRequests, reviewMemory, threadMemory],
  );
  const counts = countThreads(threads);
  const visibleThreads = threads.filter((thread) => activeFilter === "all" || thread.status === activeFilter).slice(0, 9);
  const selectedThread =
    visibleThreads.find((thread) => thread.pr.id === selectedPrId) ??
    threads.find((thread) => thread.pr.id === selectedPrId && thread.status !== "resolved" && thread.status !== "muted") ??
    visibleThreads[0] ??
    threads[0];
  const draft = selectedThread ? buildThreadReply(selectedThread) : "";
  const openBlockers = threads.filter((thread) => thread.status === "open" && thread.tone === "red").length;
  const aiThreads = threads.filter((thread) => thread.kind === "codex_gap" || thread.kind === "codex_shift").length;
  const reviewerCount = new Set(threads.map((thread) => thread.reviewer)).size;

  return (
    <section className="thread-resolver" id="review-thread-resolver" data-testid="review-thread-resolver">
      <div className="thread-head">
        <div>
          <span>Review thread resolver</span>
          <h2>{counts.open ? `${counts.open} review threads need ownership` : "Review threads are under control"}</h2>
          <p>Track human comments, requested changes, failing checks, Codex gaps, and eyes-to-thumbs-up evidence from one reply-ready queue.</p>
        </div>
        <div className="thread-actions">
          <button type="button" onClick={() => selectedThread && onCopyThreadReply(selectedThread.id, selectedThread.pr.id, draft)} disabled={!selectedThread} data-testid="thread-copy-draft">
            <Clipboard size={14} />
            Copy reply
          </button>
          <button type="button" onClick={() => selectedThread && onThreadStatusChange(selectedThread.id, "resolved")} disabled={!selectedThread} data-testid="thread-resolve-selected">
            <CheckCircle2 size={14} />
            Resolve
          </button>
          <button type="button" onClick={() => selectedThread && onThreadStatusChange(selectedThread.id, "muted")} disabled={!selectedThread}>
            <X size={14} />
            Mute
          </button>
        </div>
      </div>

      <div className="thread-metrics" aria-label="Review thread metrics">
        <ThreadMetric label="Open" value={counts.open} detail={`${openBlockers} blockers`} tone={counts.open ? "amber" : "green"} icon={MessageSquareText} />
        <ThreadMetric label="Drafted" value={counts.drafted} detail="reply ready" tone={counts.drafted ? "blue" : "green"} icon={Send} />
        <ThreadMetric label="AI threads" value={aiThreads} detail="Codex lane" tone={aiThreads ? "purple" : "green"} icon={Bot} />
        <ThreadMetric label="Reviewers" value={reviewerCount} detail="participants" tone="blue" icon={RadioTower} />
      </div>

      <div className="thread-tabs" role="tablist" aria-label="Review thread status">
        {filterOptions.map((filter) => (
          <button
            type="button"
            role="tab"
            key={filter.id}
            aria-selected={activeFilter === filter.id}
            className={activeFilter === filter.id ? "active" : ""}
            onClick={() => setActiveFilter(filter.id)}
            data-testid={`thread-filter-${filter.id}`}
          >
            <span>{filter.label}</span>
            <b>{filter.id === "all" ? threads.length : counts[filter.id]}</b>
          </button>
        ))}
      </div>

      <div className="thread-body">
        <div className="thread-list">
          <div className="thread-section-title">
            <GitPullRequest size={15} />
            <strong>Thread queue</strong>
            <span>{visibleThreads.length}</span>
          </div>
          <div className="thread-row-list">
            {visibleThreads.map((thread) => {
              const config = kindConfig[thread.kind];
              const Icon = config.icon;

              return (
                <article className={`thread-row thread-${thread.tone} status-${thread.status} ${selectedThread?.id === thread.id ? "selected" : ""}`} key={thread.id}>
                  <button type="button" className="thread-row-main" onClick={() => onOpenPullRequest(thread.pr.repo, thread.pr.id)}>
                    <span className="thread-kind">
                      <Icon size={14} />
                    </span>
                    <span className="thread-copy">
                      <strong>{thread.title}</strong>
                      <small>{thread.detail}</small>
                    </span>
                  </button>
                  <div className="thread-signals">
                    <StatusPill state={thread.pr.state} />
                    <CiBadge state={thread.pr.ci} />
                    <CodexBadge reaction={thread.pr.codex.reaction} compact />
                    <em>{thread.ageLabel}</em>
                  </div>
                  <div className="thread-row-actions">
                    <button type="button" onClick={() => onCopyThreadReply(thread.id, thread.pr.id, buildThreadReply(thread))} data-testid={`thread-draft-${toTestId(thread.id)}`}>
                      Draft
                    </button>
                    <button type="button" onClick={() => onThreadStatusChange(thread.id, "resolved")} data-testid={`thread-resolve-${toTestId(thread.id)}`}>
                      Resolve
                    </button>
                  </div>
                </article>
              );
            })}

            {!visibleThreads.length && (
              <div className="thread-empty">
                <CheckCircle2 size={18} />
                <strong>No threads in this view.</strong>
                <span>Switch filters or refresh the repo to pull in new review comments.</span>
              </div>
            )}
          </div>
        </div>

        <aside className="thread-preview">
          <div className="thread-section-title">
            <Sparkles size={15} />
            <strong>Reply cockpit</strong>
            <span>{selectedThread?.status ?? "empty"}</span>
          </div>

          {selectedThread ? (
            <>
              <div className={`thread-preview-card preview-${selectedThread.tone}`}>
                <span>{selectedThread.reviewer} · #{selectedThread.pr.number}</span>
                <strong>{selectedThread.title}</strong>
                <p>{selectedThread.body}</p>
                <div className="thread-preview-meta">
                  <em>{selectedThread.pr.repo}</em>
                  <em>{selectedThread.pr.ciSummary}</em>
                  <em>{getPrIntelligence(selectedThread.pr).readiness}/{getPrIntelligence(selectedThread.pr).readinessTotal} ready</em>
                </div>
                <pre>{draft}</pre>
                <div className="thread-preview-actions">
                  <button type="button" onClick={() => onCopyThreadReply(selectedThread.id, selectedThread.pr.id, draft)}>
                    <Clipboard size={14} />
                    Copy draft
                  </button>
                  {selectedThread.kind === "codex_gap" || selectedThread.kind === "codex_shift" ? (
                    <button type="button" onClick={() => onPromoteCodex(selectedThread.pr.id)}>
                      <ThumbsUp size={14} />
                      Promote AI
                    </button>
                  ) : selectedThread.tone === "red" ? (
                    <button type="button" onClick={() => onMarkBlocked(selectedThread.pr.id)}>
                      <ShieldAlert size={14} />
                      Mark blocked
                    </button>
                  ) : (
                    <button type="button" onClick={() => onMarkReady(selectedThread.pr.id)}>
                      <CheckCircle2 size={14} />
                      Mark ready
                    </button>
                  )}
                </div>
              </div>

              <div className="thread-related">
                <div className="thread-section-title">
                  <Eye size={15} />
                  <strong>PR context</strong>
                </div>
                <button type="button" onClick={() => onOpenPullRequest(selectedThread.pr.repo, selectedThread.pr.id)}>
                  <span>
                    <strong>{selectedThread.pr.title}</strong>
                    <small>{selectedThread.pr.branch} → {selectedThread.pr.base}</small>
                  </span>
                  <AvatarStack people={selectedThread.pr.reviewers} />
                </button>
              </div>
            </>
          ) : (
            <div className="thread-empty thread-empty-preview">
              <CheckCircle2 size={18} />
              <strong>No thread selected.</strong>
              <span>Select a thread to draft a response.</span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function ThreadMetric({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  tone: ThreadTone;
  icon: LucideIcon;
}) {
  return (
    <div className={`thread-metric metric-${tone}`}>
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function buildReviewThreads(
  pullRequests: PullRequestSummary[],
  reviewMemory: ReviewMemoryByPr,
  threadMemory: ReviewThreadMemoryById,
) {
  const threads = pullRequests
    .filter((pr) => pr.state !== "merged")
    .flatMap((pr, index) => buildThreadsForPullRequest(pr, index, reviewMemory, threadMemory));

  return threads.sort((a, b) => b.score - a.score || new Date(b.pr.updatedAt).getTime() - new Date(a.pr.updatedAt).getTime());
}

function buildThreadsForPullRequest(
  pr: PullRequestSummary,
  index: number,
  reviewMemory: ReviewMemoryByPr,
  threadMemory: ReviewThreadMemoryById,
) {
  const intel = getPrIntelligence(pr, index);
  const memory = reviewMemory[pr.id];
  const items: ReviewThreadItem[] = [];

  pr.reviewEvents
    .filter((event) => !event.reviewer.isCodex && event.state !== "approved" && event.state !== "dismissed")
    .forEach((event) => {
      const kind: ThreadKind = event.state === "changes_requested" ? "change_request" : "comment";
      const id = `${pr.id}:review:${event.id}`;
      items.push({
        id,
        pr,
        kind,
        status: threadMemory[id]?.status ?? "open",
        title: event.state === "changes_requested" ? `#${pr.number} requested changes from @${event.reviewer.login}` : `#${pr.number} comment from @${event.reviewer.login}`,
        detail: `${event.body ?? "Review comment needs a response."} · ${formatRelativeTime(event.submittedAt)}`,
        reviewer: event.reviewer.login,
        body: event.body ?? "Review comment needs a response.",
        ageLabel: formatRelativeTime(event.submittedAt),
        tone: kindConfig[kind].tone,
        score: (kind === "change_request" ? 120 : 72) + (intel.risk === "high" ? 22 : 0),
        event,
      });
    });

  if (pr.ci === "failure") {
    const id = `${pr.id}:ci`;
    items.push({
      id,
      pr,
      kind: "ci_failure",
      status: threadMemory[id]?.status ?? "open",
      title: `#${pr.number} has failing checks`,
      detail: `${pr.ciSummary}; reply with the fix plan before asking for review.`,
      reviewer: pr.author.login,
      body: pr.ciSummary,
      ageLabel: formatRelativeTime(pr.updatedAt),
      tone: "red",
      score: 112 + (intel.risk === "high" ? 16 : 0),
    });
  }

  if (!pr.codex.exists || pr.codex.reaction === "eyes") {
    const id = `${pr.id}:codex-gap`;
    items.push({
      id,
      pr,
      kind: "codex_gap",
      status: threadMemory[id]?.status ?? "open",
      title: pr.codex.exists ? `#${pr.number} Codex is still watching` : `#${pr.number} needs Codex coverage`,
      detail: `${pr.codex.statusText}; get to thumbs up before merge.`,
      reviewer: "Codex",
      body: pr.codex.statusText,
      ageLabel: formatRelativeTime(pr.codex.lastSeenAt ?? pr.updatedAt),
      tone: "purple",
      score: 92 + (pr.codex.exists ? 4 : 10),
    });
  }

  if (pr.codex.reaction === "changed") {
    const id = `${pr.id}:codex-shift`;
    items.push({
      id,
      pr,
      kind: "codex_shift",
      status: threadMemory[id]?.status ?? "open",
      title: `#${pr.number} Codex moved eyes to thumbs up`,
      detail: `${pr.codex.statusText}; verify the human thread can close.`,
      reviewer: "Codex",
      body: pr.codex.events[pr.codex.events.length - 1]?.body ?? pr.codex.statusText,
      ageLabel: formatRelativeTime(pr.codex.lastSeenAt ?? pr.updatedAt),
      tone: "green",
      score: 82,
    });
  }

  if (memory?.note && memory.decision !== "watch") {
    const id = `${pr.id}:decision-note`;
    items.push({
      id,
      pr,
      kind: "review_memory",
      status: threadMemory[id]?.status ?? "open",
      title: `#${pr.number} private decision note`,
      detail: `${memory.decision}; turn the note into a public update or close it.`,
      reviewer: pr.author.login,
      body: memory.note,
      ageLabel: formatRelativeTime(memory.updatedAt),
      tone: memory.decision === "blocked" ? "red" : "blue",
      score: memory.decision === "blocked" ? 96 : 58,
    });
  }

  return items;
}

function countThreads(threads: ReviewThreadItem[]) {
  return threads.reduce(
    (counts, thread) => ({
      ...counts,
      [thread.status]: counts[thread.status] + 1,
    }),
    {
      open: 0,
      drafted: 0,
      resolved: 0,
      muted: 0,
    } satisfies Record<ReviewThreadStatus, number>,
  );
}

function buildThreadReply(thread: ReviewThreadItem) {
  if (thread.kind === "codex_gap") {
    return `#${thread.pr.number}: Requesting/refreshing Codex review now so this has a thumbs-up signal before merge. I will follow up once the AI review is green.`;
  }

  if (thread.kind === "codex_shift") {
    return `#${thread.pr.number}: Codex moved from eyes to thumbs up. I verified the signal and am closing this as AI-reviewed unless a human reviewer sees a remaining blocker.`;
  }

  if (thread.kind === "ci_failure") {
    return `#${thread.pr.number}: I found the failing check and am treating this as blocked until the fix lands. I will rerun CI and reply with the exact validation result.`;
  }

  if (thread.kind === "change_request") {
    return `@${thread.reviewer} thanks for the review. I am addressing this requested change now, then I will push the fix and call out the files/tests touched.`;
  }

  if (thread.kind === "review_memory") {
    return `#${thread.pr.number}: Current decision is ${thread.status === "resolved" ? "resolved" : "tracked"} from my review notes. Next update: ${thread.body}`;
  }

  return `@${thread.reviewer} thanks, I picked this up. I will respond on #${thread.pr.number} with the change or decision once the check is complete.`;
}

function toTestId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
