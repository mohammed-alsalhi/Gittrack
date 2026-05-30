import {
  BellRing,
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  GitPullRequest,
  ShieldAlert,
  TimerReset,
  VolumeX,
  Zap,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import {
  PullRequestSummary,
  ReviewMemoryByPr,
  ReviewNudgeMemoryById,
  ReviewNudgeStatus,
} from "../types";
import { CiBadge, formatRelativeTime, StatusPill } from "./ui";

interface ReviewSlaCenterProps {
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  nudgeMemory: ReviewNudgeMemoryById;
  selectedId?: string;
  onSelectPullRequest: (id: string) => void;
  onUpdateNudge: (id: string, status: ReviewNudgeStatus) => void;
  onCopyNudge: (nudge: ReviewNudge) => void;
}

type NudgeKind = "reviewer" | "ci" | "codex" | "author" | "merge";
type NudgeSeverity = "critical" | "high" | "medium";

export interface ReviewNudge {
  id: string;
  pr: PullRequestSummary;
  kind: NudgeKind;
  severity: NudgeSeverity;
  title: string;
  detail: string;
  target: string;
  message: string;
  ageHours: number;
  dueLabel: string;
}

export function ReviewSlaCenter({
  pullRequests,
  reviewMemory,
  nudgeMemory,
  selectedId,
  onSelectPullRequest,
  onUpdateNudge,
  onCopyNudge,
}: ReviewSlaCenterProps) {
  const nudges = pullRequests
    .flatMap((pr, index) => buildReviewNudges(pr, index, reviewMemory))
    .map((nudge) => ({ ...nudge, status: nudgeMemory[nudge.id]?.status ?? "open" }))
    .sort((a, b) => nudgeScore(b) - nudgeScore(a));
  const active = nudges.filter((nudge) => nudge.status !== "done" && nudge.status !== "muted");
  const visible = active.slice(0, 6);
  const critical = active.filter((nudge) => nudge.severity === "critical").length;
  const copied = nudges.filter((nudge) => nudge.status === "copied").length;
  const handled = nudges.filter((nudge) => nudge.status === "done" || nudge.status === "muted").length;
  const automationHealth = critical ? "manual attention" : active.length ? "watching" : "clear";

  return (
    <section className="review-sla-center" data-testid="review-sla-center">
      <div className="sla-head">
        <div>
          <span>Reviewer SLA</span>
          <h2>{active.length} nudges need a decision</h2>
          <p>{automationHealth} · reviewer waits, CI failures, Codex gaps, and merge-ready PRs.</p>
        </div>
        <div className="sla-metric-strip" aria-label="SLA summary">
          <SlaMetric label="Hot" value={critical} tone={critical ? "red" : "green"} />
          <SlaMetric label="Drafted" value={copied} tone="blue" />
          <SlaMetric label="Handled" value={handled} tone="green" />
        </div>
      </div>

      <div className="sla-body">
        <div className="sla-list">
          <div className="sla-section-title">
            <BellRing size={15} />
            <strong>Action queue</strong>
            <span>{visible.length} visible</span>
          </div>
          {visible.map((nudge) => (
            <div
              className={`sla-row severity-${nudge.severity} status-${nudge.status} ${nudge.pr.id === selectedId ? "selected" : ""}`}
              key={nudge.id}
            >
              <button type="button" className="sla-row-main" onClick={() => onSelectPullRequest(nudge.pr.id)}>
                <span className="sla-kind-icon">{iconForKind(nudge.kind)}</span>
                <span className="sla-copy">
                  <strong>{nudge.title}</strong>
                  <small>{nudge.detail}</small>
                </span>
                <span className="sla-pr-meta">
                  <StatusPill state={nudge.pr.state} />
                  <CiBadge state={nudge.pr.ci} />
                </span>
              </button>
              <div className="sla-row-foot">
                <span><Clock3 size={13} /> {nudge.dueLabel}</span>
                <span>To {nudge.target}</span>
                <button type="button" onClick={() => onCopyNudge(nudge)}>
                  <Copy size={13} />
                  Draft
                </button>
                <button type="button" onClick={() => onUpdateNudge(nudge.id, "done")}>
                  <CheckCircle2 size={13} />
                  Done
                </button>
                <button type="button" onClick={() => onUpdateNudge(nudge.id, "muted")} aria-label={`Mute ${nudge.title}`}>
                  <VolumeX size={13} />
                </button>
              </div>
            </div>
          ))}
          {!visible.length && (
            <div className="sla-empty">
              <CheckCircle2 size={16} />
              No active reviewer nudges right now.
            </div>
          )}
        </div>

        <aside className="sla-playbook">
          <div className="sla-section-title">
            <Zap size={15} />
            <strong>Nudge playbook</strong>
          </div>
          <div className="playbook-grid">
            <PlaybookItem label="Reviewer wait" value={`${active.filter((nudge) => nudge.kind === "reviewer").length} queued`} />
            <PlaybookItem label="Author fix" value={`${active.filter((nudge) => nudge.kind === "author" || nudge.kind === "ci").length} queued`} />
            <PlaybookItem label="Codex sweep" value={`${active.filter((nudge) => nudge.kind === "codex").length} queued`} />
            <PlaybookItem label="Merge decision" value={`${active.filter((nudge) => nudge.kind === "merge").length} queued`} />
          </div>
          <div className="sla-template">
            <strong>Default tone</strong>
            <p>Short, specific, includes PR number, current blocker, and the exact action requested.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SlaMetric({ label, value, tone }: { label: string; value: number; tone: "blue" | "green" | "red" }) {
  return (
    <div className={`sla-metric metric-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PlaybookItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildReviewNudges(
  pr: PullRequestSummary,
  index: number,
  reviewMemory: ReviewMemoryByPr,
): ReviewNudge[] {
  const intel = getPrIntelligence(pr, index);
  const memory = reviewMemory[pr.id];
  const ageHours = Math.max(0, (Date.now() - new Date(pr.updatedAt).getTime()) / 36e5);
  const nudges: ReviewNudge[] = [];

  if (pr.ci === "failure") {
    nudges.push(makeNudge(pr, "ci", "critical", "Fix failing CI", pr.ciSummary, pr.author.login, ageHours));
  }

  if (pr.state === "changes_requested") {
    nudges.push(makeNudge(pr, "author", "critical", "Address requested changes", "Returned work is blocking the stack.", pr.author.login, ageHours));
  }

  if (pr.state === "waiting_review" && ageHours > 1) {
    const target = pr.reviewers.map((reviewer) => reviewer.login).join(", ") || "reviewers";
    nudges.push(makeNudge(pr, "reviewer", ageHours > 4 ? "high" : "medium", "Nudge reviewers", "Waiting for review past your SLA.", target, ageHours));
  }

  if (!pr.codex.exists || pr.codex.reaction === "eyes") {
    nudges.push(makeNudge(pr, "codex", "medium", pr.codex.exists ? "Close Codex watch" : "Request Codex sweep", pr.codex.statusText, "Codex", ageHours));
  }

  if (
    !pr.isDraft &&
    pr.ci === "success" &&
    (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1)
  ) {
    nudges.push(makeNudge(pr, "merge", "high", "Make merge call", `${intel.readiness}/${intel.readinessTotal} gates ready.`, pr.author.login, ageHours));
  }

  return nudges;
}

function makeNudge(
  pr: PullRequestSummary,
  kind: NudgeKind,
  severity: NudgeSeverity,
  title: string,
  detail: string,
  target: string,
  ageHours: number,
): ReviewNudge {
  return {
    id: `${pr.id}:${kind}`,
    pr,
    kind,
    severity,
    title,
    detail,
    target,
    ageHours,
    dueLabel: ageHours < 1 ? "fresh" : `${Math.round(ageHours)}h waiting`,
    message: `Hey ${target}, quick nudge on #${pr.number} (${pr.title}): ${detail} Current signal: ${pr.ciSummary}.`,
  };
}

function nudgeScore(nudge: ReviewNudge & { status: ReviewNudgeStatus }) {
  const severity = nudge.severity === "critical" ? 60 : nudge.severity === "high" ? 42 : 28;
  const status = nudge.status === "open" ? 12 : nudge.status === "copied" ? 4 : -24;
  return severity + Math.min(24, nudge.ageHours * 3) + status;
}

function iconForKind(kind: NudgeKind) {
  if (kind === "ci") return <ShieldAlert size={15} />;
  if (kind === "codex") return <Bot size={15} />;
  if (kind === "merge") return <GitPullRequest size={15} />;
  if (kind === "author") return <TimerReset size={15} />;
  return <BellRing size={15} />;
}
