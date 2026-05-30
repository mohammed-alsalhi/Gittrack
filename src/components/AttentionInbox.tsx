import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  Clipboard,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Inbox,
  RadioTower,
  ShieldAlert,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import type {
  ActivityEvent,
  AttentionItemMemoryById,
  AttentionItemStatus,
  BranchSummary,
  PullRequestSummary,
  RepoSummary,
  ReviewMemoryByPr,
} from "../types";
import { getPrIntelligence } from "../lib/insights";
import { BranchStatus, formatRelativeTime, StatusPill } from "./ui";

interface AttentionInboxProps {
  repos: RepoSummary[];
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  activity: ActivityEvent[];
  reviewMemory: ReviewMemoryByPr;
  attentionMemory: AttentionItemMemoryById;
  selectedPrId?: string;
  onOpenPullRequest: (repo: string, id: string) => void;
  onOpenRepo: (repo: string) => void;
  onUpdateItemStatus: (id: string, status: AttentionItemStatus) => void;
  onCopyDigest: (text: string, count: number) => void;
}

type AttentionLane = "all" | "review" | "ai" | "ship" | "ops";
type AttentionTone = "blue" | "green" | "amber" | "red" | "purple";

interface AttentionItem {
  id: string;
  lane: Exclude<AttentionLane, "all">;
  tone: AttentionTone;
  icon: LucideIcon;
  repo: string;
  title: string;
  detail: string;
  impact: string;
  action: string;
  score: number;
  updatedAt: string;
  pr?: PullRequestSummary;
  branch?: BranchSummary;
}

const laneLabels: Record<AttentionLane, string> = {
  all: "All",
  review: "Review",
  ai: "AI",
  ship: "Ship",
  ops: "Ops",
};

export function AttentionInbox({
  repos,
  pullRequests,
  branches,
  activity,
  reviewMemory,
  attentionMemory,
  selectedPrId,
  onOpenPullRequest,
  onOpenRepo,
  onUpdateItemStatus,
  onCopyDigest,
}: AttentionInboxProps) {
  const [activeLane, setActiveLane] = useState<AttentionLane>("all");
  const items = useMemo(
    () => buildAttentionItems(pullRequests, branches, activity, reviewMemory),
    [activity, branches, pullRequests, reviewMemory],
  );
  const visibleItems = items
    .filter((item) => activeLane === "all" || item.lane === activeLane)
    .filter((item) => attentionMemory[item.id]?.status !== "muted")
    .slice(0, 9);
  const urgentCount = items.filter((item) => item.tone === "red" && attentionMemory[item.id]?.status !== "done").length;
  const openCount = items.filter((item) => (attentionMemory[item.id]?.status ?? "open") === "open").length;
  const doneCount = items.filter((item) => attentionMemory[item.id]?.status === "done").length;
  const laneCounts = {
    all: items.length,
    review: items.filter((item) => item.lane === "review").length,
    ai: items.filter((item) => item.lane === "ai").length,
    ship: items.filter((item) => item.lane === "ship").length,
    ops: items.filter((item) => item.lane === "ops").length,
  };

  const openItem = (item: AttentionItem) => {
    if (item.pr) {
      onOpenPullRequest(item.repo, item.pr.id);
      return;
    }

    onOpenRepo(item.repo);
  };

  return (
    <section className="attention-inbox" id="attention-inbox" data-testid="attention-inbox">
      <div className="attention-head">
        <div>
          <span>Attention inbox</span>
          <h2>{urgentCount ? `${urgentCount} urgent signals need a decision` : "Your review operating queue is calm"}</h2>
          <p>{repos.length} repos monitored with {openCount} open signals and {doneCount} cleared items.</p>
        </div>
        <div className="attention-actions">
          <button type="button" onClick={() => onCopyDigest(formatAttentionDigest(visibleItems, attentionMemory), visibleItems.length)} data-testid="attention-copy-digest">
            <Clipboard size={14} />
            Copy digest
          </button>
        </div>
      </div>

      <div className="attention-metrics" aria-label="Attention metrics">
        <AttentionMetric label="Open" value={openCount} detail="needs action" tone={openCount ? "amber" : "green"} icon={Inbox} />
        <AttentionMetric label="Urgent" value={urgentCount} detail="red signals" tone={urgentCount ? "red" : "green"} icon={ShieldAlert} />
        <AttentionMetric label="AI" value={laneCounts.ai} detail="Codex lane" tone={laneCounts.ai ? "purple" : "green"} icon={Bot} />
        <AttentionMetric label="Ship" value={laneCounts.ship} detail="ready lane" tone={laneCounts.ship ? "green" : "blue"} icon={GitMerge} />
      </div>

      <div className="attention-lanes" role="tablist" aria-label="Attention lanes">
        {(["all", "review", "ai", "ship", "ops"] as const).map((lane) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeLane === lane}
            key={lane}
            className={activeLane === lane ? "active" : ""}
            onClick={() => setActiveLane(lane)}
            data-testid={`attention-lane-${lane}`}
          >
            <span>{laneLabels[lane]}</span>
            <b>{laneCounts[lane]}</b>
          </button>
        ))}
      </div>

      <div className="attention-body">
        <div className="attention-list">
          {visibleItems.map((item, index) => {
            const status = attentionMemory[item.id]?.status ?? "open";
            const Icon = item.icon;

            return (
              <article
                className={`attention-item attention-${item.tone} ${item.pr?.id === selectedPrId ? "selected" : ""}`}
                key={item.id}
              >
                <button type="button" className="attention-main" onClick={() => openItem(item)}>
                  <span className="attention-rank">{index + 1}</span>
                  <span className="attention-icon"><Icon size={16} /></span>
                  <span className="attention-copy">
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                  {item.pr ? <StatusPill state={item.pr.state} /> : item.branch ? <BranchStatus branch={item.branch.health} /> : <RadioTower size={15} />}
                </button>

                <div className="attention-meta">
                  <span>{item.repo}</span>
                  <span>{item.impact}</span>
                  <span>{formatRelativeTime(item.updatedAt)}</span>
                  <em className={`attention-status status-${status}`}>{status}</em>
                </div>

                <div className="attention-item-actions">
                  <button type="button" onClick={() => openItem(item)}>
                    {item.action}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateItemStatus(item.id, status === "acknowledged" ? "open" : "acknowledged")}
                    data-testid="attention-ack"
                  >
                    {status === "acknowledged" ? "Reopen" : "Ack"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateItemStatus(item.id, status === "done" ? "open" : "done")}
                    data-testid="attention-done"
                  >
                    {status === "done" ? "Restore" : "Done"}
                  </button>
                </div>
              </article>
            );
          })}

          {!visibleItems.length && (
            <div className="attention-empty">
              <CheckCircle2 size={17} />
              <strong>No active signals in this lane.</strong>
              <span>Cleared, muted, or completed items stay out of your way.</span>
            </div>
          )}
        </div>

        <aside className="attention-runway">
          <div className="attention-section-title">
            <Bell size={15} />
            <strong>Signal mix</strong>
            <span>{items.length} total</span>
          </div>
          <div className="attention-signal-bars">
            {(["review", "ai", "ship", "ops"] as const).map((lane) => (
              <button type="button" key={lane} onClick={() => setActiveLane(lane)}>
                <span>{laneLabels[lane]}</span>
                <i style={{ width: `${Math.max(8, Math.round((laneCounts[lane] / Math.max(1, items.length)) * 100))}%` }} />
                <strong>{laneCounts[lane]}</strong>
              </button>
            ))}
          </div>

          <div className="attention-section-title">
            <TimerReset size={15} />
            <strong>Recent activity</strong>
          </div>
          <div className="attention-activity-mini">
            {activity.slice(0, 4).map((event) => (
              <button type="button" key={event.id} onClick={() => onOpenRepo(event.repo)}>
                <span className={`attention-dot dot-${event.state}`} />
                <strong>{event.title}</strong>
                <small>{event.detail}</small>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function AttentionMetric({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  tone: AttentionTone;
  icon: LucideIcon;
}) {
  return (
    <div className={`attention-metric metric-${tone}`}>
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function buildAttentionItems(
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  activity: ActivityEvent[],
  reviewMemory: ReviewMemoryByPr,
) {
  const items: AttentionItem[] = [];

  pullRequests.forEach((pr, index) => {
    const intel = getPrIntelligence(pr, index);
    const memory = reviewMemory[pr.id];
    const isReady =
      !pr.isDraft &&
      pr.ci === "success" &&
      pr.state !== "changes_requested" &&
      (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1);

    if (memory?.decision === "blocked" || pr.ci === "failure" || pr.state === "changes_requested") {
      items.push({
        id: `pr:${pr.id}:blocker`,
        lane: "review",
        tone: "red",
        icon: AlertTriangle,
        repo: pr.repo,
        title: `Unblock #${pr.number}`,
        detail: `${pr.title} has ${pr.ciSummary.toLowerCase()} and ${pr.state.replace("_", " ")} state.`,
        impact: "queue blocker",
        action: "Inspect blocker",
        score: 98 + (intel.risk === "high" ? 4 : 0),
        updatedAt: pr.updatedAt,
        pr,
      });
    }

    if (!pr.codex.exists || pr.codex.reaction === "eyes") {
      items.push({
        id: `pr:${pr.id}:codex`,
        lane: "ai",
        tone: pr.codex.reaction === "eyes" ? "purple" : "amber",
        icon: Bot,
        repo: pr.repo,
        title: pr.codex.exists ? `Codex is watching #${pr.number}` : `Request Codex on #${pr.number}`,
        detail: pr.codex.statusText,
        impact: "AI review signal",
        action: "Open AI lane",
        score: pr.codex.exists ? 74 : 69,
        updatedAt: pr.codex.lastSeenAt ?? pr.updatedAt,
        pr,
      });
    }

    if (isReady) {
      items.push({
        id: `pr:${pr.id}:ship`,
        lane: "ship",
        tone: "green",
        icon: GitMerge,
        repo: pr.repo,
        title: `Ship candidate #${pr.number}`,
        detail: `${pr.title} is ${intel.readiness}/${intel.readinessTotal} ready with ${pr.ciSummary.toLowerCase()}.`,
        impact: intel.queueEstimate,
        action: "Open launch",
        score: 82 + intel.readiness,
        updatedAt: pr.updatedAt,
        pr,
      });
    }

    if (pr.state === "waiting_review" || pr.reviewers.length === 0) {
      items.push({
        id: `pr:${pr.id}:review`,
        lane: "review",
        tone: "amber",
        icon: GitPullRequest,
        repo: pr.repo,
        title: `Review attention on #${pr.number}`,
        detail: pr.reviewers.length ? `${pr.reviewers.length} reviewers assigned; updated ${formatRelativeTime(pr.updatedAt)}.` : "No reviewer assigned yet.",
        impact: "review wait",
        action: "Route review",
        score: 66 + (pr.reviewers.length ? 0 : 8),
        updatedAt: pr.updatedAt,
        pr,
      });
    }
  });

  branches
    .filter((branch) => branch.health === "behind" || branch.health === "diverged" || branch.health === "stale")
    .forEach((branch) => {
      items.push({
        id: `branch:${branch.id}:drift`,
        lane: "ops",
        tone: branch.health === "diverged" ? "red" : "amber",
        icon: GitBranch,
        repo: branch.repo,
        title: `Branch drift: ${branch.name}`,
        detail: `${branch.ahead} ahead / ${branch.behind} behind ${branch.repo}.`,
        impact: branch.health,
        action: "Open repo",
        score: branch.health === "diverged" ? 78 : 58,
        updatedAt: branch.updatedAt,
        branch,
      });
    });

  activity.slice(0, 5).forEach((event) => {
    items.push({
      id: `activity:${event.id}`,
      lane: "ops",
      tone: event.state === "failure" || event.state === "changes_requested" ? "red" : event.state === "approved" || event.state === "success" ? "green" : "blue",
      icon: RadioTower,
      repo: event.repo,
      title: event.title,
      detail: event.detail,
      impact: "activity",
      action: "Open repo",
      score: 44,
      updatedAt: event.at,
    });
  });

  return items.sort((a, b) => {
    const score = b.score - a.score;
    if (score !== 0) return score;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function formatAttentionDigest(items: AttentionItem[], memory: AttentionItemMemoryById) {
  return [
    "GitTrack attention digest",
    `Generated ${new Date().toLocaleString()}`,
    "",
    ...items.map((item, index) => {
      const status = memory[item.id]?.status ?? "open";
      return `${index + 1}. [${status}] ${item.title} - ${item.detail}`;
    }),
  ].join("\n");
}
