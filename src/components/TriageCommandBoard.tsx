import { useMemo, useState } from "react";
import {
  Bell,
  Bot,
  CheckCircle2,
  Clipboard,
  GitMerge,
  GitPullRequest,
  RadioTower,
  Rocket,
  ShieldAlert,
  Sparkles,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import type { PullRequestSummary, RepoSummary, ReviewMemoryByPr } from "../types";
import { AvatarStack, CiBadge, CodexBadge, formatRelativeTime, StatusPill } from "./ui";

interface TriageCommandBoardProps {
  repos: RepoSummary[];
  pullRequests: PullRequestSummary[];
  reviewMemory: ReviewMemoryByPr;
  selectedPrId?: string;
  onOpenPullRequest: (repo: string, id: string) => void;
  onMarkReady: (id: string) => void;
  onMarkBlocked: (id: string) => void;
  onPinReview: (id: string) => void;
  onPromoteCodex: (id: string) => void;
  onSmartMerge: (id: string) => void;
  onCopyBoard: (text: string, count: number) => void;
  onOpenDecisionSimulator: () => void;
}

type TriageLaneId = "all" | "blockers" | "review" | "ai" | "ship";
type TriageTone = "blue" | "green" | "amber" | "red" | "purple";

interface TriageLaneConfig {
  id: Exclude<TriageLaneId, "all">;
  label: string;
  detail: string;
  action: string;
  tone: TriageTone;
  icon: LucideIcon;
}

interface TriageItem {
  id: string;
  lane: Exclude<TriageLaneId, "all">;
  pr: PullRequestSummary;
  title: string;
  detail: string;
  signal: string;
  primaryLabel: string;
  secondaryLabel: string;
  score: number;
  tone: TriageTone;
  readiness: string;
}

const laneConfigs: TriageLaneConfig[] = [
  {
    id: "blockers",
    label: "Blockers",
    detail: "Failures, requested changes, and blocked decisions.",
    action: "Mark blocked",
    tone: "red",
    icon: ShieldAlert,
  },
  {
    id: "review",
    label: "Review",
    detail: "Waiting reviews, draft exits, and reviewer gaps.",
    action: "Pin review",
    tone: "amber",
    icon: TimerReset,
  },
  {
    id: "ai",
    label: "AI",
    detail: "Missing Codex coverage and eyes-only reviews.",
    action: "Promote AI",
    tone: "purple",
    icon: Bot,
  },
  {
    id: "ship",
    label: "Ship",
    detail: "Green candidates ready for the merge train.",
    action: "Queue merge",
    tone: "green",
    icon: Rocket,
  },
];

export function TriageCommandBoard({
  repos,
  pullRequests,
  reviewMemory,
  selectedPrId,
  onOpenPullRequest,
  onMarkReady,
  onMarkBlocked,
  onPinReview,
  onPromoteCodex,
  onSmartMerge,
  onCopyBoard,
  onOpenDecisionSimulator,
}: TriageCommandBoardProps) {
  const [activeLane, setActiveLane] = useState<TriageLaneId>("all");
  const board = useMemo(
    () => buildTriageBoard(pullRequests, reviewMemory),
    [pullRequests, reviewMemory],
  );
  const visibleLanes = activeLane === "all" ? laneConfigs : laneConfigs.filter((lane) => lane.id === activeLane);
  const focusCount = board.blockers.length + board.review.length + board.ai.length;
  const boardText = formatTriageBoard(board, repos.length);

  return (
    <section className="triage-board" id="triage-board" data-testid="triage-board">
      <div className="triage-head">
        <div>
          <span>Triage command board</span>
          <h2>{focusCount ? `${focusCount} queue moves need a call` : "Every active lane is calm"}</h2>
          <p>{repos.length} repos grouped into blocker, review, AI, and ship lanes with one-click actions.</p>
        </div>
        <div className="triage-actions">
          <button type="button" onClick={onOpenDecisionSimulator}>
            <Sparkles size={14} />
            Simulate
          </button>
          <button type="button" onClick={() => onCopyBoard(boardText, board.total)} data-testid="triage-copy-board">
            <Clipboard size={14} />
            Copy board
          </button>
        </div>
      </div>

      <div className="triage-metrics" aria-label="Triage metrics">
        <TriageMetric label="Blockers" value={board.blockers.length} detail="needs unblock" tone={board.blockers.length ? "red" : "green"} icon={ShieldAlert} />
        <TriageMetric label="Review wait" value={board.review.length} detail="needs human" tone={board.review.length ? "amber" : "green"} icon={TimerReset} />
        <TriageMetric label="AI gaps" value={board.ai.length} detail="Codex lane" tone={board.ai.length ? "purple" : "green"} icon={Bot} />
        <TriageMetric label="Ship-ready" value={board.ship.length} detail="merge train" tone={board.ship.length ? "green" : "blue"} icon={GitMerge} />
      </div>

      <div className="triage-lane-tabs" role="tablist" aria-label="Triage lanes">
        <button
          type="button"
          role="tab"
          aria-selected={activeLane === "all"}
          className={activeLane === "all" ? "active" : ""}
          onClick={() => setActiveLane("all")}
          data-testid="triage-lane-all"
        >
          <RadioTower size={14} />
          <span>All lanes</span>
          <b>{board.total}</b>
        </button>
        {laneConfigs.map((lane) => {
          const Icon = lane.icon;

          return (
            <button
              type="button"
              role="tab"
              aria-selected={activeLane === lane.id}
              className={activeLane === lane.id ? "active" : ""}
              key={lane.id}
              onClick={() => setActiveLane(lane.id)}
              data-testid={`triage-lane-${lane.id}`}
            >
              <Icon size={14} />
              <span>{lane.label}</span>
              <b>{board[lane.id].length}</b>
            </button>
          );
        })}
      </div>

      <div className="triage-columns">
        {visibleLanes.map((lane) => {
          const Icon = lane.icon;
          const items = board[lane.id];

          return (
            <section className={`triage-column triage-${lane.tone}`} key={lane.id}>
              <div className="triage-column-head">
                <span className="triage-column-icon">
                  <Icon size={15} />
                </span>
                <div>
                  <strong>{lane.label}</strong>
                  <small>{lane.detail}</small>
                </div>
                <b>{items.length}</b>
              </div>

              <div className="triage-card-list">
                {items.slice(0, 5).map((item) => (
                  <article className={`triage-card ${item.pr.id === selectedPrId ? "selected" : ""}`} key={item.id}>
                    <button type="button" className="triage-card-main" onClick={() => onOpenPullRequest(item.pr.repo, item.pr.id)}>
                      <span className="triage-card-title">
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <StatusPill state={item.pr.state} />
                    </button>

                    <div className="triage-card-meta">
                      <span>{item.pr.repo}</span>
                      <span>{item.readiness}</span>
                      <span>{formatRelativeTime(item.pr.updatedAt)}</span>
                    </div>

                    <div className="triage-card-signals">
                      <CiBadge state={item.pr.ci} />
                      <CodexBadge reaction={item.pr.codex.reaction} compact />
                      <AvatarStack people={item.pr.reviewers} />
                      <em>{item.signal}</em>
                    </div>

                    <div className="triage-card-actions">
                      <button type="button" onClick={() => runPrimaryAction(item, onMarkBlocked, onPinReview, onPromoteCodex, onSmartMerge)} data-testid={`triage-primary-${item.lane}`}>
                        {item.primaryLabel}
                      </button>
                      <button type="button" onClick={() => runSecondaryAction(item, onOpenPullRequest, onMarkReady)} data-testid={`triage-secondary-${item.lane}`}>
                        {item.secondaryLabel}
                      </button>
                    </div>
                  </article>
                ))}

                {!items.length && (
                  <div className="triage-empty">
                    <CheckCircle2 size={16} />
                    <strong>No active cards.</strong>
                    <span>{lane.label} lane is clear.</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function TriageMetric({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  tone: TriageTone;
  icon: LucideIcon;
}) {
  return (
    <div className={`triage-metric metric-${tone}`}>
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function buildTriageBoard(
  pullRequests: PullRequestSummary[],
  reviewMemory: ReviewMemoryByPr,
) {
  const lanes: Record<Exclude<TriageLaneId, "all">, TriageItem[]> = {
    blockers: [],
    review: [],
    ai: [],
    ship: [],
  };

  pullRequests
    .filter((pr) => pr.state !== "merged")
    .forEach((pr, index) => {
      const intel = getPrIntelligence(pr, index);
      const memory = reviewMemory[pr.id];
      const readiness = `${intel.readiness}/${intel.readinessTotal} ready`;
      const blocked = pr.ci === "failure" || pr.state === "changes_requested" || memory?.decision === "blocked";
      const waiting = pr.state === "waiting_review" || pr.reviewers.length === 0 || pr.isDraft;
      const aiGap = !pr.codex.exists || pr.codex.reaction === "eyes";
      const shipReady =
        !pr.isDraft &&
        pr.ci === "success" &&
        pr.state !== "changes_requested" &&
        memory?.decision !== "blocked" &&
        (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1);

      if (blocked) {
        lanes.blockers.push({
          id: `blockers:${pr.id}`,
          lane: "blockers",
          pr,
          title: `#${pr.number} ${cleanTitle(pr.title)}`,
          detail: `${pr.ciSummary.toLowerCase()} · ${pr.state.replace("_", " ")}`,
          signal: intel.risk,
          primaryLabel: "Mark blocked",
          secondaryLabel: "Inspect",
          score: 100 + (pr.ci === "failure" ? 20 : 0) + (intel.risk === "high" ? 10 : 0),
          tone: "red",
          readiness,
        });
      }

      if (waiting) {
        lanes.review.push({
          id: `review:${pr.id}`,
          lane: "review",
          pr,
          title: `#${pr.number} ${cleanTitle(pr.title)}`,
          detail: pr.isDraft ? "Draft work needs a reviewable slice" : pr.reviewers.length ? `${pr.reviewers.length} reviewers assigned` : "No reviewer assigned",
          signal: memory?.pinned ? "pinned" : "waiting",
          primaryLabel: "Pin review",
          secondaryLabel: "Open",
          score: 78 + (pr.reviewers.length ? 0 : 8) + (pr.isDraft ? 4 : 0),
          tone: pr.isDraft ? "blue" : "amber",
          readiness,
        });
      }

      if (aiGap) {
        lanes.ai.push({
          id: `ai:${pr.id}`,
          lane: "ai",
          pr,
          title: `#${pr.number} ${cleanTitle(pr.title)}`,
          detail: pr.codex.statusText,
          signal: pr.codex.exists ? "eyes" : "missing",
          primaryLabel: pr.codex.exists ? "Promote AI" : "Request AI",
          secondaryLabel: "Open",
          score: pr.codex.exists ? 72 : 66,
          tone: pr.codex.exists ? "purple" : "amber",
          readiness,
        });
      }

      if (shipReady) {
        lanes.ship.push({
          id: `ship:${pr.id}`,
          lane: "ship",
          pr,
          title: `#${pr.number} ${cleanTitle(pr.title)}`,
          detail: `${pr.ciSummary.toLowerCase()} · ${intel.queueEstimate} lane`,
          signal: intel.queueEstimate,
          primaryLabel: "Queue merge",
          secondaryLabel: "Ready",
          score: 90 + intel.readiness - (intel.risk === "high" ? 16 : 0),
          tone: "green",
          readiness,
        });
      }
    });

  Object.values(lanes).forEach((lane) => lane.sort((a, b) => b.score - a.score || new Date(b.pr.updatedAt).getTime() - new Date(a.pr.updatedAt).getTime()));

  return {
    ...lanes,
    total: lanes.blockers.length + lanes.review.length + lanes.ai.length + lanes.ship.length,
  };
}

function runPrimaryAction(
  item: TriageItem,
  onMarkBlocked: (id: string) => void,
  onPinReview: (id: string) => void,
  onPromoteCodex: (id: string) => void,
  onSmartMerge: (id: string) => void,
) {
  if (item.lane === "blockers") onMarkBlocked(item.pr.id);
  if (item.lane === "review") onPinReview(item.pr.id);
  if (item.lane === "ai") onPromoteCodex(item.pr.id);
  if (item.lane === "ship") onSmartMerge(item.pr.id);
}

function runSecondaryAction(
  item: TriageItem,
  onOpenPullRequest: (repo: string, id: string) => void,
  onMarkReady: (id: string) => void,
) {
  if (item.lane === "ship") {
    onMarkReady(item.pr.id);
    return;
  }

  onOpenPullRequest(item.pr.repo, item.pr.id);
}

function formatTriageBoard(
  board: ReturnType<typeof buildTriageBoard>,
  repoCount: number,
) {
  return [
    `GitTrack triage board · ${repoCount} repos`,
    `Blockers: ${board.blockers.length}`,
    `Review: ${board.review.length}`,
    `AI: ${board.ai.length}`,
    `Ship: ${board.ship.length}`,
    "",
    ...laneConfigs.flatMap((lane) => [
      `${lane.label}:`,
      ...(board[lane.id].length
        ? board[lane.id].slice(0, 5).map((item) => `- #${item.pr.number} ${item.pr.title} (${item.signal})`)
        : ["- Clear"]),
      "",
    ]),
  ].join("\n");
}

function cleanTitle(title: string) {
  return title.replace(/^(feat|fix|chore|docs|refactor|test):\s*/i, "");
}
