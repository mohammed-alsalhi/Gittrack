import {
  Activity,
  BellOff,
  Bot,
  CheckCircle2,
  Clock3,
  GitMerge,
  GitPullRequest,
  Pin,
  ShieldAlert,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { getPrIntelligence, PrIntelligence } from "../lib/insights";
import { PullRequestSummary, ReviewMemory, ReviewMemoryByPr } from "../types";
import { CiBadge, formatRelativeTime, StatusPill } from "./ui";

interface ReviewCommandDeckProps {
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  selectedId?: string;
  onSelectPullRequest: (id: string) => void;
  onPinPullRequest: (id: string) => void;
  onSnoozePullRequest: (id: string) => void;
  onMarkReady: (id: string) => void;
  onSmartMerge: (id: string) => void;
  onPromoteCodex: (id: string) => void;
  onSetQuery: (value: string) => void;
}

type TriageLane = "review" | "ship" | "blocked" | "ai";

interface TriageCandidate {
  pr: PullRequestSummary;
  intel: PrIntelligence;
  memory?: ReviewMemory;
  lane: TriageLane;
  score: number;
  reason: string;
  action: string;
}

export function ReviewCommandDeck({
  pullRequests,
  reviewMemory,
  selectedId,
  onSelectPullRequest,
  onPinPullRequest,
  onSnoozePullRequest,
  onMarkReady,
  onSmartMerge,
  onPromoteCodex,
  onSetQuery,
}: ReviewCommandDeckProps) {
  const candidates = pullRequests
    .map((pr, index) => buildTriageCandidate(pr, index, reviewMemory[pr.id]))
    .sort((a, b) => b.score - a.score);
  const actNow = candidates.find((item) => item.lane !== "ship") ?? candidates[0];
  const shipNow = candidates.find((item) => item.lane === "ship");
  const aiTask = candidates.find((item) => item.lane === "ai");
  const quietTask =
    candidates.find((item) => item.pr.isDraft && !item.memory?.snoozedUntil) ??
    candidates.find((item) => item.lane === "review" && item.score < 24);
  const blockedCount = candidates.filter((item) => item.lane === "blocked").length;
  const shipCount = candidates.filter((item) => item.lane === "ship").length;
  const aiCount = candidates.filter((item) => item.lane === "ai").length;
  const pinnedCount = candidates.filter((item) => item.memory?.pinned).length;
  const chatCount = candidates.reduce((total, item) => total + (item.memory?.chat.length ? 1 : 0), 0);

  const runCandidateAction = (candidate: TriageCandidate) => {
    onSelectPullRequest(candidate.pr.id);

    if (candidate.lane === "ship") {
      onMarkReady(candidate.pr.id);
      onSmartMerge(candidate.pr.id);
      return;
    }

    if (candidate.lane === "ai") {
      onPromoteCodex(candidate.pr.id);
      return;
    }

    onPinPullRequest(candidate.pr.id);
  };

  if (!candidates.length) {
    return (
      <section className="review-command-deck empty" data-testid="review-command-deck">
        <Sparkles size={18} />
        <strong>No pull requests in this repository.</strong>
      </section>
    );
  }

  return (
    <section className="review-command-deck" data-testid="review-command-deck">
      <div className="command-deck-head">
        <div>
          <span>Triage cockpit</span>
          <h2>Ranked action plan for this repo</h2>
          <p>Uses CI, review state, Codex signal, stack position, and your saved decisions.</p>
        </div>
        <div className="deck-score-strip" aria-label="Triage summary">
          <DeckMetric label="Ship" value={shipCount} tone="green" />
          <DeckMetric label="Blocked" value={blockedCount} tone={blockedCount ? "red" : "green"} />
          <DeckMetric label="AI" value={aiCount} tone={aiCount ? "amber" : "green"} />
        </div>
      </div>

      <div className="command-deck-body">
        {actNow && (
          <div className={`priority-card lane-${actNow.lane}`}>
            <div className="priority-card-top">
              <span><Target size={14} /> Do this next</span>
              <em>{actNow.score}% priority</em>
            </div>
            <h3>#{actNow.pr.number} {actNow.pr.title}</h3>
            <p>{actNow.reason}</p>
            <div className="priority-meta">
              <span><GitPullRequest size={13} /> {actNow.pr.branch}</span>
              <span><Clock3 size={13} /> {formatRelativeTime(actNow.pr.updatedAt)}</span>
              <CiBadge state={actNow.pr.ci} />
            </div>
            <div className="priority-actions">
              <button type="button" className="deck-primary-action" onClick={() => runCandidateAction(actNow)}>
                <Zap size={14} />
                {actNow.action}
              </button>
              <button type="button" onClick={() => onSelectPullRequest(actNow.pr.id)}>
                Inspect
              </button>
            </div>
          </div>
        )}

        <div className="deck-action-grid">
          <ActionTile
            title="Ship candidate"
            icon={<GitMerge size={15} />}
            candidate={shipNow}
            empty="Nothing merge-ready"
            onClick={(candidate) => runCandidateAction(candidate)}
          />
          <ActionTile
            title="AI sweep"
            icon={<Bot size={15} />}
            candidate={aiTask}
            empty="Codex signals clear"
            onClick={(candidate) => runCandidateAction(candidate)}
          />
          <ActionTile
            title="Quiet noise"
            icon={<BellOff size={15} />}
            candidate={quietTask}
            empty="No low-priority noise"
            onClick={(candidate) => onSnoozePullRequest(candidate.pr.id)}
          />
        </div>

        <div className="triage-lanes">
          <div className="deck-section-title">
            <Activity size={15} />
            <strong>Smart lanes</strong>
            <span>{candidates.length} ranked</span>
          </div>
          <div className="triage-lane-list">
            {candidates.slice(0, 6).map((candidate, index) => (
              <button
                type="button"
                key={candidate.pr.id}
                className={`triage-lane-row lane-${candidate.lane} ${candidate.pr.id === selectedId ? "selected" : ""}`}
                onClick={() => onSelectPullRequest(candidate.pr.id)}
              >
                <span className="triage-rank">{index + 1}</span>
                <span className="triage-copy">
                  <strong>#{candidate.pr.number} {candidate.pr.title}</strong>
                  <small>{candidate.reason}</small>
                </span>
                <span className="triage-state">
                  <StatusPill state={candidate.pr.state} />
                  <em>{candidate.intel.readiness}/{candidate.intel.readinessTotal}</em>
                </span>
                <span className="triage-action">{candidate.action}</span>
              </button>
            ))}
          </div>
        </div>

        <aside className="deck-memory-panel">
          <div className="deck-section-title">
            <CheckCircle2 size={15} />
            <strong>Review memory</strong>
          </div>
          <div className="memory-stat-grid">
            <DeckMetric label="Pinned" value={pinnedCount} tone="blue" />
            <DeckMetric label="Chats" value={chatCount} tone="blue" />
            <DeckMetric label="Ready" value={candidates.filter((item) => item.memory?.decision === "ready").length} tone="green" />
            <DeckMetric label="Manual blocks" value={candidates.filter((item) => item.memory?.decision === "blocked").length} tone="red" />
          </div>
          <div className="deck-query-chips" aria-label="Quick searches">
            <button type="button" onClick={() => onSetQuery("pinned")}>
              <Pin size={13} />
              Pinned
            </button>
            <button type="button" onClick={() => onSetQuery("snoozed")}>
              <BellOff size={13} />
              Snoozed
            </button>
            <button type="button" onClick={() => onSetQuery("Codex")}>
              <Bot size={13} />
              Codex
            </button>
            <button type="button" onClick={() => onSetQuery("blocked")}>
              <ShieldAlert size={13} />
              Blocked
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ActionTile({
  title,
  icon,
  candidate,
  empty,
  onClick,
}: {
  title: string;
  icon: ReactNode;
  candidate?: TriageCandidate;
  empty: string;
  onClick: (candidate: TriageCandidate) => void;
}) {
  return (
    <button
      type="button"
      className={candidate ? `deck-action-tile lane-${candidate.lane}` : "deck-action-tile empty"}
      onClick={() => candidate && onClick(candidate)}
      disabled={!candidate}
    >
      <span>{icon}{title}</span>
      {candidate ? (
        <>
          <strong>#{candidate.pr.number} {candidate.pr.title}</strong>
          <em>{candidate.action}</em>
        </>
      ) : (
        <strong>{empty}</strong>
      )}
    </button>
  );
}

function DeckMetric({ label, value, tone }: { label: string; value: number; tone: "blue" | "green" | "amber" | "red" }) {
  return (
    <div className={`deck-metric metric-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function buildTriageCandidate(
  pr: PullRequestSummary,
  index: number,
  memory?: ReviewMemory,
): TriageCandidate {
  const intel = getPrIntelligence(pr, index);
  const snoozed = Boolean(memory?.snoozedUntil && new Date(memory.snoozedUntil).getTime() > Date.now());
  const readyToShip =
    (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1) &&
    pr.ci === "success" &&
    !pr.isDraft &&
    !snoozed;
  const blocked =
    memory?.decision === "blocked" ||
    pr.state === "changes_requested" ||
    pr.ci === "failure" ||
    (pr.reviewers.length === 0 && !pr.isDraft);
  const aiNeeded = !pr.codex.exists || pr.codex.reaction === "eyes";
  const lane: TriageLane = blocked ? "blocked" : readyToShip ? "ship" : aiNeeded ? "ai" : "review";
  const ageHours = Math.max(0, (Date.now() - new Date(pr.updatedAt).getTime()) / 36e5);
  const score = Math.min(
    99,
    Math.round(
      28 +
        (memory?.pinned ? 20 : 0) +
        (blocked ? 22 : 0) +
        (readyToShip ? 18 : 0) +
        (aiNeeded ? 10 : 0) +
        (intel.risk === "high" ? 16 : intel.risk === "medium" ? 8 : 2) +
        (pr.ci === "failure" ? 12 : pr.ci === "pending" ? 6 : 0) +
        (ageHours < 3 ? 8 : ageHours > 24 ? 5 : 2) -
        (snoozed ? 16 : 0),
    ),
  );

  if (blocked) {
    return {
      pr,
      intel,
      memory,
      lane,
      score,
      reason:
        memory?.decision === "blocked"
          ? "Manual block in your review memory."
          : pr.state === "changes_requested"
            ? "Returned work is holding the stack."
            : pr.ci === "failure"
              ? pr.ciSummary
              : "Needs a reviewer before it can move.",
      action: "Focus + pin",
    };
  }

  if (readyToShip) {
    return {
      pr,
      intel,
      memory,
      lane,
      score,
      reason: "Green enough to stage into the merge train.",
      action: "Queue merge",
    };
  }

  if (aiNeeded) {
    return {
      pr,
      intel,
      memory,
      lane,
      score,
      reason: pr.codex.exists ? "Codex is watching but not approved yet." : "No Codex review signal found.",
      action: "Promote Codex",
    };
  }

  return {
    pr,
    intel,
    memory,
    lane,
    score,
    reason: snoozed ? "Snoozed in your personal queue." : "Review when your focus lane is clear.",
    action: "Inspect",
  };
}
