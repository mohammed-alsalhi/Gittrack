import { useEffect, useMemo, useState } from "react";
import {
  BellDot,
  CheckCircle2,
  Clipboard,
  Eye,
  GitBranch,
  RadioTower,
  ShieldAlert,
  Sparkles,
  ThumbsUp,
  TimerReset,
  Workflow,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import type {
  ActivityEvent,
  BranchHealth,
  BranchSummary,
  ChangeRadarMemory,
  ChangeRadarMode,
  CheckState,
  PullRequestSummary,
  PullRequestState,
  RepoSummary,
  ReviewMemoryByPr,
} from "../types";
import { CiBadge, CodexBadge, formatRelativeTime, StatusPill } from "./ui";

interface ChangeRadarCenterProps {
  repos: RepoSummary[];
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  activity: ActivityEvent[];
  reviewMemory: ReviewMemoryByPr;
  memory: ChangeRadarMemory;
  selectedPrId?: string;
  onModeChange: (mode: ChangeRadarMode) => void;
  onAcknowledgeSignal: (id: string) => void;
  onCheckpoint: (ids: string[]) => void;
  onToggleTrackedPr: (id: string) => void;
  onCopySweep: (text: string, count: number) => void;
  onOpenPullRequest: (repo: string, id: string) => void;
  onOpenRepo: (repo: string) => void;
  onPromoteCodex: (id: string) => void;
  onMarkReady: (id: string) => void;
}

interface ChangeSignal {
  id: string;
  kind: ChangeSignalKind;
  tone: ChangeSignalTone;
  title: string;
  detail: string;
  repo: string;
  at: string;
  prId?: string;
  prNumber?: number;
  branchId?: string;
  branchName?: string;
  action: "open" | "promote_codex" | "mark_ready";
}

interface ChangeRadarStats {
  unseen: number;
  codex: number;
  risk: number;
  ship: number;
  tracked: number;
}

type ChangeSignalKind = "activity" | "branch" | "ci" | "codex" | "ready" | "review";
type ChangeSignalTone = "blue" | "green" | "amber" | "red" | "purple";

const modeConfig: Array<{
  id: ChangeRadarMode;
  label: string;
  detail: string;
  icon: LucideIcon;
}> = [
  {
    id: "unseen",
    label: "Unseen",
    detail: "Fresh movement",
    icon: BellDot,
  },
  {
    id: "codex",
    label: "Codex",
    detail: "Eyes, approvals, gaps",
    icon: Sparkles,
  },
  {
    id: "risk",
    label: "Risk",
    detail: "CI, drift, blockers",
    icon: ShieldAlert,
  },
  {
    id: "ship",
    label: "Ship",
    detail: "Ready candidates",
    icon: CheckCircle2,
  },
];

export function ChangeRadarCenter({
  repos,
  pullRequests,
  branches,
  activity,
  reviewMemory,
  memory,
  selectedPrId,
  onModeChange,
  onAcknowledgeSignal,
  onCheckpoint,
  onToggleTrackedPr,
  onCopySweep,
  onOpenPullRequest,
  onOpenRepo,
  onPromoteCodex,
  onMarkReady,
}: ChangeRadarCenterProps) {
  const signals = useMemo(
    () => buildChangeSignals(pullRequests, branches, activity, reviewMemory),
    [activity, branches, pullRequests, reviewMemory],
  );
  const acknowledged = useMemo(() => new Set(memory.acknowledgedSignalIds), [memory.acknowledgedSignalIds]);
  const tracked = useMemo(() => new Set(memory.trackedPrIds), [memory.trackedPrIds]);
  const stats = useMemo(() => buildStats(signals, memory, acknowledged, tracked), [acknowledged, memory, signals, tracked]);
  const filteredSignals = useMemo(
    () => filterSignals(signals, memory.mode, memory, acknowledged, tracked),
    [acknowledged, memory, signals, tracked],
  );
  const defaultSignalId =
    filteredSignals.find((signal) => signal.prId === selectedPrId)?.id ??
    filteredSignals[0]?.id;
  const [selectedSignalId, setSelectedSignalId] = useState(defaultSignalId);
  const selectedSignal =
    filteredSignals.find((signal) => signal.id === selectedSignalId) ??
    filteredSignals[0];
  const selectedPr = selectedSignal?.prId ? pullRequests.find((pr) => pr.id === selectedSignal.prId) : undefined;
  const sweepText = formatChangeSweep(filteredSignals.length ? filteredSignals : signals, stats, memory, repos.length);

  useEffect(() => {
    setSelectedSignalId((current) =>
      current && filteredSignals.some((signal) => signal.id === current)
        ? current
        : defaultSignalId,
    );
  }, [defaultSignalId, filteredSignals]);

  const runSignalAction = (signal: ChangeSignal) => {
    if (signal.action === "promote_codex" && signal.prId) {
      onPromoteCodex(signal.prId);
      return;
    }

    if (signal.action === "mark_ready" && signal.prId) {
      onMarkReady(signal.prId);
      return;
    }

    if (signal.prId) {
      onOpenPullRequest(signal.repo, signal.prId);
      return;
    }

    onOpenRepo(signal.repo);
  };

  return (
    <section className="change-radar" id="change-radar" data-testid="change-radar">
      <div className="change-radar-head">
        <div>
          <span>Change radar</span>
          <h2>{stats.unseen} signals need your eyes</h2>
          <p>
            Track what moved since your last checkpoint across Codex reviews, CI, branch drift, review requests, and ship-ready PRs.
          </p>
        </div>
        <div className="change-radar-actions">
          <button type="button" onClick={() => onCopySweep(sweepText, filteredSignals.length || signals.length)} data-testid="change-copy">
            <Clipboard size={14} />
            Copy sweep
          </button>
          <button type="button" onClick={() => onCheckpoint(signals.map((signal) => signal.id))} data-testid="change-checkpoint">
            <CheckCircle2 size={14} />
            Mark all seen
          </button>
        </div>
      </div>

      <div className="change-radar-metrics" aria-label="Change radar metrics">
        <ChangeMetric label="Unseen" value={stats.unseen} detail={memory.lastCheckpointAt ? `Since ${formatRelativeTime(memory.lastCheckpointAt)}` : "First pass"} tone={stats.unseen ? "blue" : "green"} icon={BellDot} />
        <ChangeMetric label="Codex shifts" value={stats.codex} detail="eyes and thumbs" tone={stats.codex ? "purple" : "green"} icon={Sparkles} />
        <ChangeMetric label="Risk moves" value={stats.risk} detail="CI, drift, blockers" tone={stats.risk ? "red" : "green"} icon={ShieldAlert} />
        <ChangeMetric label="Tracked" value={stats.tracked} detail={`${repos.length} repos watched`} tone={stats.tracked ? "amber" : "blue"} icon={Eye} />
      </div>

      <div className="change-radar-body">
        <aside className="change-radar-scope" aria-label="Change radar modes">
          <div className="change-section-title">
            <Workflow size={15} />
            <strong>Scope</strong>
            <span>{filteredSignals.length}</span>
          </div>
          <div className="change-mode-tabs" role="tablist" aria-label="Change radar scopes">
            {modeConfig.map((mode) => {
              const Icon = mode.icon;
              const selected = memory.mode === mode.id;

              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={selected ? "active" : ""}
                  key={mode.id}
                  onClick={() => onModeChange(mode.id)}
                  data-testid={`change-mode-${mode.id}`}
                >
                  <Icon size={15} />
                  <span>
                    <strong>{mode.label}</strong>
                    <small>{mode.detail}</small>
                  </span>
                  <em>{countForMode(stats, mode.id)}</em>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="change-signal-stream">
          <div className="change-stream-head">
            <div>
              <span>{memory.lastCheckpointAt ? `Checkpoint ${formatRelativeTime(memory.lastCheckpointAt)}` : "No checkpoint yet"}</span>
              <strong>{filteredSignals.length} live signals</strong>
            </div>
            <button type="button" onClick={() => selectedSignal && onAcknowledgeSignal(selectedSignal.id)} disabled={!selectedSignal} data-testid="change-ack-selected">
              <CheckCircle2 size={14} />
              Acknowledge selected
            </button>
          </div>

          <div className="change-signal-list">
            {filteredSignals.map((signal, index) => {
              const seen = acknowledged.has(signal.id);
              const trackedSignal = Boolean(signal.prId && tracked.has(signal.prId));
              const selected = selectedSignal?.id === signal.id;

              return (
                <article className={`change-signal signal-${signal.tone} ${seen ? "seen" : ""} ${selected ? "selected" : ""}`} key={signal.id}>
                  <button
                    type="button"
                    className="change-signal-main"
                    onClick={() => setSelectedSignalId(signal.id)}
                    data-testid={index === 0 ? "change-select-first" : undefined}
                  >
                    <span className="change-signal-icon">
                      <SignalIcon signal={signal} />
                    </span>
                    <span>
                      <strong>{signal.title}</strong>
                      <small>{signal.detail}</small>
                    </span>
                  </button>
                  <div className="change-signal-meta">
                    <em>{formatRelativeTime(signal.at)}</em>
                    {trackedSignal && <em className="tracked">tracked</em>}
                    <button
                      type="button"
                      onClick={() => onAcknowledgeSignal(signal.id)}
                      data-testid={index === 0 ? "change-ack-first" : undefined}
                    >
                      {seen ? "Seen" : "Ack"}
                    </button>
                  </div>
                </article>
              );
            })}
            {!filteredSignals.length && (
              <div className="change-empty change-empty-stream">
                <CheckCircle2 size={18} />
                <strong>No signals in this scope</strong>
                <span>Switch scopes or refresh your GitHub data to pick up new movement.</span>
              </div>
            )}
          </div>
        </div>

        <aside className="change-radar-preview">
          <div className="change-section-title">
            <RadioTower size={15} />
            <strong>Signal brief</strong>
            <span>{selectedSignal?.tone ?? "blue"}</span>
          </div>

          {selectedSignal ? (
            <>
              <div className={`change-preview-card preview-${selectedSignal.tone}`}>
                <span>{selectedSignal.kind}</span>
                <strong>{selectedSignal.title}</strong>
                <p>{selectedSignal.detail}</p>
                <div className="change-preview-tags">
                  <em>{selectedSignal.repo}</em>
                  {selectedSignal.prNumber && <em>#{selectedSignal.prNumber}</em>}
                  {selectedSignal.branchName && <em>{selectedSignal.branchName}</em>}
                  <em>{formatRelativeTime(selectedSignal.at)}</em>
                </div>
              </div>

              {selectedPr && (
                <div className="change-pr-card">
                  <div>
                    <strong>#{selectedPr.number} {selectedPr.title}</strong>
                    <small>{selectedPr.branch} into {selectedPr.base}</small>
                  </div>
                  <div className="change-pr-badges">
                    <StatusPill state={selectedPr.state} />
                    <CiBadge state={selectedPr.ci} />
                    <CodexBadge reaction={selectedPr.codex.reaction} compact />
                  </div>
                  <div className="change-pr-meter">
                    <span style={{ width: `${readinessPercent(selectedPr)}%` }} />
                  </div>
                </div>
              )}

              <div className="change-preview-actions">
                <button type="button" onClick={() => runSignalAction(selectedSignal)} data-testid="change-run-selected">
                  <Sparkles size={14} />
                  {actionLabel(selectedSignal)}
                </button>
                {selectedSignal.prId && (
                  <button type="button" onClick={() => onToggleTrackedPr(selectedSignal.prId as string)} data-testid="change-track-first">
                    <Eye size={14} />
                    {tracked.has(selectedSignal.prId) ? "Untrack PR" : "Track PR"}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="change-empty">
              <CheckCircle2 size={18} />
              <strong>No signals in this scope</strong>
              <span>Switch scopes or refresh your GitHub data to pick up new movement.</span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function ChangeMetric({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  tone: ChangeSignalTone;
  icon: LucideIcon;
}) {
  return (
    <div className={`change-metric metric-${tone}`}>
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function SignalIcon({ signal }: { signal: ChangeSignal }) {
  if (signal.kind === "branch") return <GitBranch size={15} />;
  if (signal.kind === "ci") return signal.tone === "red" ? <XCircle size={15} /> : <CheckCircle2 size={15} />;
  if (signal.kind === "codex") return signal.tone === "green" ? <ThumbsUp size={15} /> : <Sparkles size={15} />;
  if (signal.kind === "ready") return <CheckCircle2 size={15} />;
  if (signal.kind === "review") return <ShieldAlert size={15} />;
  return <TimerReset size={15} />;
}

function buildChangeSignals(
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  activity: ActivityEvent[],
  reviewMemory: ReviewMemoryByPr,
) {
  const prsByNumber = new Map(pullRequests.map((pr) => [`${pr.repo}#${pr.number}`, pr]));
  const signals: ChangeSignal[] = [];

  activity.forEach((event) => {
    const pr = findPrForActivity(event, prsByNumber);
    signals.push({
      id: `activity:${event.id}`,
      kind: kindFromActivity(event),
      tone: toneFromActivity(event),
      title: event.title,
      detail: event.detail,
      repo: event.repo,
      at: event.at,
      prId: pr?.id,
      prNumber: pr?.number,
      action: pr ? "open" : "open",
    });
  });

  pullRequests
    .filter((pr) => pr.state !== "merged")
    .forEach((pr, index) => {
      const intel = getPrIntelligence(pr, index);
      const memory = reviewMemory[pr.id];
      const ready =
        !pr.isDraft &&
        pr.ci === "success" &&
        memory?.decision !== "blocked" &&
        (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1);

      if (pr.codex.reaction === "changed") {
        signals.push(makePrSignal(pr, "codex", "green", "Codex moved to thumbs up", pr.codex.statusText, pr.codex.lastSeenAt ?? pr.updatedAt, "open"));
      } else if (pr.codex.reaction === "eyes") {
        signals.push(makePrSignal(pr, "codex", "purple", "Codex is still at eyes", "The review exists, but the lane has not reached thumbs-up yet.", pr.codex.lastSeenAt ?? pr.updatedAt, "promote_codex"));
      } else if (!pr.codex.exists) {
        signals.push(makePrSignal(pr, "codex", "purple", "Missing Codex coverage", "No Codex review signal has been detected for this PR.", pr.updatedAt, "promote_codex"));
      }

      if (pr.ci === "failure") {
        signals.push(makePrSignal(pr, "ci", "red", "CI gate failed", pr.ciSummary, pr.updatedAt, "open"));
      } else if (pr.ci === "pending") {
        signals.push(makePrSignal(pr, "ci", "amber", "CI is still running", pr.ciSummary, pr.updatedAt, "open"));
      }

      if (pr.state === "changes_requested" || memory?.decision === "blocked") {
        signals.push(makePrSignal(pr, "review", "red", "Review is blocking", pr.state === "changes_requested" ? "Changes were requested and need a reply or fix." : "You marked this PR blocked in local review memory.", latestReviewAt(pr), "open"));
      }

      if (ready) {
        signals.push(makePrSignal(pr, "ready", "green", "Ready candidate detected", `Readiness is ${intel.readiness}/${intel.readinessTotal}; queue estimate ${intel.queueEstimate}.`, pr.updatedAt, "mark_ready"));
      }
    });

  branches
    .filter((branch) => branch.health === "behind" || branch.health === "diverged" || branch.health === "stale")
    .forEach((branch) => {
      signals.push({
        id: `branch:${branch.id}:${branch.health}`,
        kind: "branch",
        tone: branch.health === "diverged" ? "red" : "amber",
        title: branch.health === "diverged" ? "Branch diverged from main" : "Branch needs a sync pass",
        detail: `${branch.name} is ${branch.ahead} ahead and ${branch.behind} behind.`,
        repo: branch.repo,
        at: branch.updatedAt,
        branchId: branch.id,
        branchName: branch.name,
        action: "open",
      });
    });

  return signals.sort((a, b) => signalRank(b) - signalRank(a) || new Date(b.at).getTime() - new Date(a.at).getTime());
}

function makePrSignal(
  pr: PullRequestSummary,
  kind: ChangeSignalKind,
  tone: ChangeSignalTone,
  title: string,
  detail: string,
  at: string,
  action: ChangeSignal["action"],
): ChangeSignal {
  return {
    id: `${pr.id}:${kind}:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    kind,
    tone,
    title,
    detail,
    repo: pr.repo,
    at,
    prId: pr.id,
    prNumber: pr.number,
    action,
  };
}

function buildStats(
  signals: ChangeSignal[],
  memory: ChangeRadarMemory,
  acknowledged: Set<string>,
  tracked: Set<string>,
): ChangeRadarStats {
  return {
    unseen: signals.filter((signal) => isUnseen(signal, memory, acknowledged)).length,
    codex: signals.filter((signal) => signal.kind === "codex" && !acknowledged.has(signal.id)).length,
    risk: signals.filter((signal) => isRiskSignal(signal) && !acknowledged.has(signal.id)).length,
    ship: signals.filter((signal) => signal.kind === "ready" && !acknowledged.has(signal.id)).length,
    tracked: signals.filter((signal) => signal.prId && tracked.has(signal.prId)).length,
  };
}

function filterSignals(
  signals: ChangeSignal[],
  mode: ChangeRadarMode,
  memory: ChangeRadarMemory,
  acknowledged: Set<string>,
  tracked: Set<string>,
) {
  const filtered = signals.filter((signal) => {
    if (mode === "unseen") return isUnseen(signal, memory, acknowledged);
    if (mode === "codex") return signal.kind === "codex";
    if (mode === "risk") return isRiskSignal(signal);
    return signal.kind === "ready";
  });

  return [...filtered].sort((a, b) => {
    const aTracked = a.prId && tracked.has(a.prId) ? 1 : 0;
    const bTracked = b.prId && tracked.has(b.prId) ? 1 : 0;
    return bTracked - aTracked || signalRank(b) - signalRank(a) || new Date(b.at).getTime() - new Date(a.at).getTime();
  });
}

function isUnseen(signal: ChangeSignal, memory: ChangeRadarMemory, acknowledged: Set<string>) {
  if (acknowledged.has(signal.id)) return false;
  if (!memory.lastCheckpointAt) return true;
  return new Date(signal.at).getTime() >= new Date(memory.lastCheckpointAt).getTime();
}

function isRiskSignal(signal: ChangeSignal) {
  return signal.tone === "red" || signal.kind === "ci" || signal.kind === "review" || signal.kind === "branch";
}

function signalRank(signal: ChangeSignal) {
  const toneScore: Record<ChangeSignalTone, number> = {
    red: 50,
    purple: 40,
    amber: 35,
    green: 30,
    blue: 20,
  };
  const kindScore: Record<ChangeSignalKind, number> = {
    review: 16,
    ci: 14,
    codex: 12,
    branch: 10,
    ready: 8,
    activity: 6,
  };

  return toneScore[signal.tone] + kindScore[signal.kind];
}

function findPrForActivity(event: ActivityEvent, prsByNumber: Map<string, PullRequestSummary>) {
  const match = event.detail.match(/#(\d+)/) ?? event.title.match(/#(\d+)/);
  if (!match) return undefined;
  return prsByNumber.get(`${event.repo}#${match[1]}`);
}

function kindFromActivity(event: ActivityEvent): ChangeSignalKind {
  const text = `${event.title} ${event.detail}`.toLowerCase();
  if (text.includes("codex")) return "codex";
  if (text.includes("ci") || isCheckState(event.state)) return "ci";
  if (text.includes("requested") || text.includes("review")) return "review";
  return "activity";
}

function toneFromActivity(event: ActivityEvent): ChangeSignalTone {
  if (event.state === "failure" || event.state === "changes_requested" || event.state === "diverged") return "red";
  if (event.state === "pending" || event.state === "behind" || event.state === "ahead" || event.state === "stale") return "amber";
  if (event.state === "approved" || event.state === "success" || event.state === "healthy") return "green";
  if (/codex/i.test(`${event.title} ${event.detail}`)) return "purple";
  return "blue";
}

function isCheckState(value: PullRequestState | BranchHealth | CheckState): value is CheckState {
  return value === "success" || value === "failure" || value === "pending" || value === "unknown";
}

function latestReviewAt(pr: PullRequestSummary) {
  return pr.reviewEvents.reduce((latest, event) => {
    return new Date(event.submittedAt).getTime() > new Date(latest).getTime() ? event.submittedAt : latest;
  }, pr.updatedAt);
}

function readinessPercent(pr: PullRequestSummary) {
  const intel = getPrIntelligence(pr);
  return Math.max(0, Math.min(100, Math.round((intel.readiness / intel.readinessTotal) * 100)));
}

function countForMode(stats: ChangeRadarStats, mode: ChangeRadarMode) {
  if (mode === "codex") return stats.codex;
  if (mode === "risk") return stats.risk;
  if (mode === "ship") return stats.ship;
  return stats.unseen;
}

function actionLabel(signal: ChangeSignal) {
  if (signal.action === "promote_codex") return "Promote Codex";
  if (signal.action === "mark_ready") return "Mark ready";
  return signal.prId ? "Open PR" : "Open repo";
}

function formatChangeSweep(
  signals: ChangeSignal[],
  stats: ChangeRadarStats,
  memory: ChangeRadarMemory,
  repoCount: number,
) {
  const checkpoint = memory.lastCheckpointAt ? `Last checkpoint: ${formatRelativeTime(memory.lastCheckpointAt)}` : "Last checkpoint: not set";

  return [
    "GitTrack change radar",
    `${stats.unseen} unseen · ${stats.codex} Codex · ${stats.risk} risk · ${stats.ship} ship-ready · ${repoCount} repos`,
    checkpoint,
    "",
    ...signals.slice(0, 8).map((signal) => {
      const target = signal.prNumber ? `${signal.repo}#${signal.prNumber}` : signal.branchName ? `${signal.repo}:${signal.branchName}` : signal.repo;
      return `- ${target}: ${signal.title} (${formatRelativeTime(signal.at)}) - ${signal.detail}`;
    }),
  ].join("\n");
}
