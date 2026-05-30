import {
  Archive,
  ArrowRight,
  Clipboard,
  FileText,
  GitMerge,
  GitPullRequest,
  MessageSquareText,
  RadioTower,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { ActivityEvent, PullRequestSummary, ReviewMemoryByPr, ShipRoomBriefMode, ShipRoomBriefSnapshot } from "../types";
import { getPrIntelligence } from "../lib/insights";
import { formatRelativeTime, StatusPill } from "./ui";

interface ShipRoomBriefProps {
  repo: string;
  activity: ActivityEvent[];
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  briefs: ShipRoomBriefSnapshot[];
  mode: ShipRoomBriefMode;
  onModeChange: (mode: ShipRoomBriefMode) => void;
  onSaveBrief: (brief: ShipRoomBriefSnapshot) => void;
  onCopyBrief: (brief: ShipRoomBriefSnapshot) => void;
  onSelectPullRequest: (id: string) => void;
}

export function ShipRoomBrief({
  repo,
  activity,
  pullRequests,
  reviewMemory,
  briefs,
  mode,
  onModeChange,
  onSaveBrief,
  onCopyBrief,
  onSelectPullRequest,
}: ShipRoomBriefProps) {
  const currentBrief = buildShipRoomBrief(repo, mode, pullRequests, activity, reviewMemory);
  const repoBriefs = briefs.filter((brief) => brief.repo === repo).slice(0, 4);
  const previous = repoBriefs[0];
  const deltas = previous ? getBriefDeltas(currentBrief, previous) : [];
  const focusPr =
    pullRequests.find((pr) => pr.state === "changes_requested" || pr.ci === "failure") ??
    pullRequests.find((pr) => {
      const memory = reviewMemory[pr.id];
      const intel = getPrIntelligence(pr);
      return memory?.decision === "ready" || intel.readiness >= intel.readinessTotal - 1;
    }) ??
    pullRequests[0];

  return (
    <section className="ship-room-brief" data-testid="ship-room-brief">
      <div className="brief-head">
        <div>
          <span>Ship room brief</span>
          <h2>{currentBrief.title}</h2>
          <p>{deltas.length ? deltas.join(" · ") : "First saved snapshot will become your baseline."}</p>
        </div>
        <div className="brief-mode-switch" role="tablist" aria-label="Brief mode">
          {(["standup", "slack", "release"] as const).map((item) => (
            <button
              type="button"
              key={item}
              className={mode === item ? "active" : ""}
              onClick={() => onModeChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="brief-body">
        <div className="brief-draft">
          <div className="brief-section-title">
            <Sparkles size={15} />
            <strong>Generated brief</strong>
            <span>{currentBrief.body.length} lines</span>
          </div>
          <ol className="brief-line-list">
            {currentBrief.body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <div className="brief-actions">
            <button type="button" className="brief-primary" onClick={() => onCopyBrief(currentBrief)}>
              <Clipboard size={14} />
              Copy brief
            </button>
            <button type="button" onClick={() => onSaveBrief(currentBrief)}>
              <Archive size={14} />
              Save snapshot
            </button>
          </div>
        </div>

        <div className="brief-metrics">
          <BriefMetric icon={<GitPullRequest size={15} />} label="Open" value={currentBrief.metrics.open} />
          <BriefMetric icon={<GitMerge size={15} />} label="Ready" value={currentBrief.metrics.ready} tone="green" />
          <BriefMetric icon={<ShieldAlert size={15} />} label="Blocked" value={currentBrief.metrics.blocked} tone={currentBrief.metrics.blocked ? "red" : "green"} />
          <BriefMetric icon={<RadioTower size={15} />} label="Codex pending" value={currentBrief.metrics.codexPending} tone={currentBrief.metrics.codexPending ? "amber" : "green"} />
        </div>

        <div className="brief-focus-card">
          <div className="brief-section-title">
            <MessageSquareText size={15} />
            <strong>Suggested follow-up</strong>
          </div>
          {focusPr ? (
            <button type="button" className="brief-focus-pr" onClick={() => onSelectPullRequest(focusPr.id)}>
              <span>
                <strong>#{focusPr.number} {focusPr.title}</strong>
                <small>{focusPr.ciSummary} · updated {formatRelativeTime(focusPr.updatedAt)}</small>
              </span>
              <StatusPill state={focusPr.state} />
              <ArrowRight size={15} />
            </button>
          ) : (
            <p>No active PR needs a follow-up.</p>
          )}
          <div className="brief-activity-mini">
            {activity.slice(0, 3).map((event) => (
              <div key={event.id}>
                <span className={`timeline-dot state-${event.state}`} />
                <p>{event.detail}</p>
                <time>{formatRelativeTime(event.at)}</time>
              </div>
            ))}
          </div>
        </div>

        <aside className="brief-history">
          <div className="brief-section-title">
            <FileText size={15} />
            <strong>Saved briefs</strong>
            <span>{repoBriefs.length}</span>
          </div>
          <div className="brief-history-list">
            {repoBriefs.map((brief) => (
              <button type="button" key={brief.id} onClick={() => onCopyBrief(brief)}>
                <strong>{brief.title}</strong>
                <small>{formatRelativeTime(brief.createdAt)} · {brief.mode}</small>
                <em>{brief.metrics.ready} ready / {brief.metrics.blocked} blocked</em>
              </button>
            ))}
            {!repoBriefs.length && <p>No saved brief snapshots yet.</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function BriefMetric({
  icon,
  label,
  value,
  tone = "blue",
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  return (
    <div className={`brief-metric metric-${tone}`}>
      {icon}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function buildShipRoomBrief(
  repo: string,
  mode: ShipRoomBriefMode,
  pullRequests: PullRequestSummary[],
  activity: ActivityEvent[],
  reviewMemory: ReviewMemoryByPr,
): ShipRoomBriefSnapshot {
  const insights = pullRequests.map((pr, index) => ({ pr, intel: getPrIntelligence(pr, index), memory: reviewMemory[pr.id] }));
  const open = pullRequests.filter((pr) => pr.state !== "merged").length;
  const ready = insights.filter(({ pr, intel, memory }) =>
    (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1) &&
    pr.ci === "success" &&
    !pr.isDraft,
  );
  const blocked = insights.filter(({ pr, memory }) =>
    memory?.decision === "blocked" ||
    pr.state === "changes_requested" ||
    pr.ci === "failure" ||
    (pr.reviewers.length === 0 && !pr.isDraft),
  );
  const codexPending = pullRequests.filter((pr) => !pr.codex.exists || pr.codex.reaction === "eyes");
  const topReady = ready[0]?.pr;
  const topBlocked = blocked[0]?.pr;
  const latest = activity[0]?.detail ?? "No new activity yet.";
  const modeLead =
    mode === "release"
      ? "Release note"
      : mode === "slack"
        ? "Slack-ready update"
        : "Standup brief";
  const body = [
    `${modeLead}: ${open} active PRs in ${repo}; ${ready.length} ready to merge and ${blocked.length} blocked.`,
    topReady ? `Ship next: #${topReady.number} ${topReady.title} (${topReady.ciSummary}).` : "Ship next: no PR is cleanly merge-ready yet.",
    topBlocked ? `Unblock: #${topBlocked.number} ${topBlocked.title} (${topBlocked.ciSummary}).` : "Unblock: no high-priority blocker detected.",
    codexPending.length ? `AI sweep: ${codexPending.length} PRs still need Codex signal or approval.` : "AI sweep: Codex signals are clear.",
    `Latest signal: ${latest}`,
  ];

  return {
    id: `brief-${repo}-${mode}-${Date.now()}`,
    repo,
    mode,
    title: `${modeLead} · ${repo}`,
    body,
    metrics: {
      open,
      ready: ready.length,
      blocked: blocked.length,
      codexPending: codexPending.length,
    },
    createdAt: new Date().toISOString(),
  };
}

function getBriefDeltas(current: ShipRoomBriefSnapshot, previous: ShipRoomBriefSnapshot) {
  const deltas = [
    metricDelta("open", current.metrics.open, previous.metrics.open),
    metricDelta("ready", current.metrics.ready, previous.metrics.ready),
    metricDelta("blocked", current.metrics.blocked, previous.metrics.blocked),
    metricDelta("Codex pending", current.metrics.codexPending, previous.metrics.codexPending),
  ].filter(Boolean);

  return deltas.length ? deltas : ["No metric changes since the last saved brief."];
}

function metricDelta(label: string, current: number, previous: number) {
  const delta = current - previous;
  if (delta === 0) return "";
  return `${label} ${delta > 0 ? "+" : ""}${delta}`;
}
