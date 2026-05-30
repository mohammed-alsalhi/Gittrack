import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Eye,
  GitCommitHorizontal,
  GitPullRequest,
  Radar,
  ShieldCheck,
  Sparkles,
  TimerReset,
} from "lucide-react";
import {
  PullRequestSummary,
  ReviewEvent,
  ReviewMemoryByPr,
} from "../types";
import { CiBadge, formatRelativeTime, StatusPill } from "./ui";

interface ReviewFreshnessRadarProps {
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  selectedId?: string;
  onSelectPullRequest: (id: string) => void;
  onVerifyFreshness: (id: string) => void;
  onCopyRereview: (item: ReviewFreshnessItem) => void;
}

type FreshnessStatus = "stale" | "needs_review" | "codex_gap" | "verified" | "fresh";

export interface ReviewFreshnessItem {
  pr: PullRequestSummary;
  status: FreshnessStatus;
  title: string;
  detail: string;
  lastHumanReview?: ReviewEvent;
  lastCodexReview?: ReviewEvent;
  changedAt: string;
  verifiedAt?: string;
  message: string;
  score: number;
}

export function ReviewFreshnessRadar({
  pullRequests,
  reviewMemory,
  selectedId,
  onSelectPullRequest,
  onVerifyFreshness,
  onCopyRereview,
}: ReviewFreshnessRadarProps) {
  const items = pullRequests
    .filter((pr) => pr.state !== "merged")
    .map((pr) => buildFreshnessItem(pr, reviewMemory))
    .sort((a, b) => b.score - a.score);
  const visible = items.slice(0, 7);
  const stale = items.filter((item) => item.status === "stale").length;
  const codexGaps = items.filter((item) => item.status === "codex_gap").length;
  const verified = items.filter((item) => item.status === "verified").length;
  const mergeSafe = items.filter((item) => item.status === "fresh" || item.status === "verified").length;
  const headline = stale || codexGaps
    ? `${stale + codexGaps} freshness risks before merge`
    : "Reviews are fresh enough to ship";

  return (
    <section className="review-freshness-radar" data-testid="review-freshness-radar">
      <div className="freshness-head">
        <div>
          <span>Review freshness</span>
          <h2>{headline}</h2>
          <p>Tracks whether human approvals and Codex signals still apply after the latest branch update.</p>
        </div>
        <div className="freshness-metric-strip" aria-label="Review freshness summary">
          <FreshnessMetric label="Stale" value={stale} tone={stale ? "red" : "green"} />
          <FreshnessMetric label="Codex gaps" value={codexGaps} tone={codexGaps ? "amber" : "green"} />
          <FreshnessMetric label="Verified" value={verified} tone="blue" />
          <FreshnessMetric label="Merge safe" value={mergeSafe} tone="green" />
        </div>
      </div>

      <div className="freshness-body">
        <div className="freshness-list">
          <div className="freshness-section-title">
            <Radar size={15} />
            <strong>Freshness queue</strong>
            <span>{visible.length} PRs scanned</span>
          </div>

          {visible.map((item) => (
            <div
              className={`freshness-row freshness-${item.status} ${item.pr.id === selectedId ? "selected" : ""}`}
              key={item.pr.id}
            >
              <button type="button" className="freshness-row-main" onClick={() => onSelectPullRequest(item.pr.id)}>
                <span className="freshness-kind-icon">{iconForStatus(item.status)}</span>
                <span className="freshness-copy">
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
                <span className="freshness-pr-meta">
                  <StatusPill state={item.pr.state} />
                  <CiBadge state={item.pr.ci} />
                </span>
              </button>

              <div className="freshness-row-foot">
                <span>
                  <GitCommitHorizontal size={13} />
                  Changed {formatRelativeTime(item.changedAt)}
                </span>
                <span>
                  <Eye size={13} />
                  Human {formatReviewTime(item.lastHumanReview)}
                </span>
                <span>
                  <Bot size={13} />
                  Codex {formatReviewTime(item.lastCodexReview)}
                </span>
                <button type="button" onClick={() => onVerifyFreshness(item.pr.id)} data-testid={`verify-freshness-${item.pr.number}`}>
                  <ClipboardCheck size={13} />
                  Verify
                </button>
                <button type="button" onClick={() => onCopyRereview(item)}>
                  <Copy size={13} />
                  Draft
                </button>
              </div>
            </div>
          ))}

          {!visible.length && (
            <div className="freshness-empty">
              <CheckCircle2 size={16} />
              No open PRs need freshness tracking.
            </div>
          )}
        </div>

        <aside className="freshness-rules">
          <div className="freshness-section-title">
            <ShieldCheck size={15} />
            <strong>Merge gate</strong>
          </div>
          <div className="freshness-rule-grid">
            <RuleItem label="Human review" value="Must be newer than latest push" />
            <RuleItem label="Codex signal" value="Re-run when code changes after approval" />
            <RuleItem label="Local verify" value="Marks current diff as inspected" />
          </div>
          <div className="freshness-focus-card">
            <span>Most urgent</span>
            <strong>{items[0]?.title ?? "Nothing waiting"}</strong>
            <p>{items[0]?.detail ?? "Every visible review signal is current for the selected repository."}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function FreshnessMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "amber" | "red";
}) {
  return (
    <div className={`freshness-metric metric-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function RuleItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildFreshnessItem(
  pr: PullRequestSummary,
  reviewMemory: ReviewMemoryByPr,
): ReviewFreshnessItem {
  const lastHumanReview = latestReview(pr.reviewEvents.filter((event) => !event.reviewer.isCodex));
  const lastCodexReview = latestReview(pr.codex.events);
  const changedAt = pr.updatedAt;
  const changedTime = new Date(changedAt).getTime();
  const humanTime = lastHumanReview ? new Date(lastHumanReview.submittedAt).getTime() : 0;
  const codexTime = lastCodexReview ? new Date(lastCodexReview.submittedAt).getTime() : 0;
  const memory = reviewMemory[pr.id];
  const verifiedAt = memory?.checklist.read_diff && memory.checklist.checked_codex ? memory.updatedAt : undefined;
  const verifiedTime = verifiedAt ? new Date(verifiedAt).getTime() : 0;
  const locallyVerified = verifiedTime >= changedTime;
  const hasHumanApproval = pr.reviewEvents.some((event) => !event.reviewer.isCodex && event.state === "approved");
  const humanStale = hasHumanApproval && humanTime < changedTime;
  const codexStale = Boolean(lastCodexReview) && codexTime < changedTime;
  const codexMissing = !lastCodexReview || !pr.codex.exists || pr.codex.reaction === "eyes";

  if (locallyVerified) {
    return makeItem(
      pr,
      "verified",
      "Verified current diff",
      `You verified this PR after its latest branch update ${formatRelativeTime(changedAt)}.`,
      lastHumanReview,
      lastCodexReview,
      changedAt,
      verifiedAt,
      24,
    );
  }

  if (humanStale || codexStale) {
    const staleLabel = humanStale && codexStale ? "Human and Codex reviews" : humanStale ? "Human approval" : "Codex approval";
    return makeItem(
      pr,
      "stale",
      `${staleLabel} may be stale`,
      `#${pr.number} changed after ${humanStale ? "approval" : "Codex"}; re-check before merge.`,
      lastHumanReview,
      lastCodexReview,
      changedAt,
      verifiedAt,
      90 + (pr.state === "approved" ? 20 : 0),
    );
  }

  if (codexMissing) {
    return makeItem(
      pr,
      "codex_gap",
      pr.codex.exists ? "Codex is still watching" : "Codex review missing",
      `#${pr.number} needs an AI sweep on the current diff before you trust the merge signal.`,
      lastHumanReview,
      lastCodexReview,
      changedAt,
      verifiedAt,
      68 + (pr.ci === "success" ? 8 : 0),
    );
  }

  if (!hasHumanApproval && !pr.isDraft) {
    return makeItem(
      pr,
      "needs_review",
      "Human approval still needed",
      `#${pr.number} has no current approval recorded.`,
      lastHumanReview,
      lastCodexReview,
      changedAt,
      verifiedAt,
      56,
    );
  }

  return makeItem(
    pr,
    "fresh",
    "Reviews match latest diff",
    `#${pr.number} has review signals newer than its latest branch update.`,
    lastHumanReview,
    lastCodexReview,
    changedAt,
    verifiedAt,
    pr.state === "approved" ? 42 : 34,
  );
}

function makeItem(
  pr: PullRequestSummary,
  status: FreshnessStatus,
  title: string,
  detail: string,
  lastHumanReview: ReviewEvent | undefined,
  lastCodexReview: ReviewEvent | undefined,
  changedAt: string,
  verifiedAt: string | undefined,
  score: number,
): ReviewFreshnessItem {
  const target = lastHumanReview?.reviewer.login ?? pr.reviewers.find((reviewer) => !reviewer.isCodex)?.login ?? pr.author.login;
  return {
    pr,
    status,
    title,
    detail,
    lastHumanReview,
    lastCodexReview,
    changedAt,
    verifiedAt,
    score,
    message: `Hey ${target}, can you re-check #${pr.number} (${pr.title})? ${detail} Latest branch update: ${formatRelativeTime(changedAt)}. Current CI: ${pr.ciSummary}.`,
  };
}

function latestReview(events: ReviewEvent[]) {
  return [...events].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  )[0];
}

function formatReviewTime(event?: ReviewEvent) {
  return event ? formatRelativeTime(event.submittedAt) : "missing";
}

function iconForStatus(status: FreshnessStatus) {
  if (status === "stale") return <TimerReset size={15} />;
  if (status === "codex_gap") return <Bot size={15} />;
  if (status === "needs_review") return <GitPullRequest size={15} />;
  if (status === "verified") return <ClipboardCheck size={15} />;
  return <Sparkles size={15} />;
}
