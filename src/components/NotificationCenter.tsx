import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  GitBranch,
  GitPullRequest,
  RadioTower,
  ShieldAlert,
  Sparkles,
  ThumbsUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import type { BranchSummary, PullRequestSummary, ReviewMemoryByPr } from "../types";
import { formatRelativeTime } from "./ui";

interface NotificationCenterProps {
  open: boolean;
  signals: NotificationSignal[];
  seenSignalIds: string[];
  onClose: () => void;
  onMarkSeen: (id: string) => void;
  onMarkAllSeen: (ids: string[]) => void;
  onOpenPullRequest: (repo: string, id: string) => void;
  onOpenRepo: (repo: string) => void;
  onPromoteCodex: (id: string) => void;
  onMarkReady: (id: string) => void;
  onOpenChangeRadar: () => void;
}

export interface NotificationSignal {
  id: string;
  kind: "branch" | "ci" | "codex" | "ready" | "review";
  tone: "blue" | "green" | "amber" | "red" | "purple";
  title: string;
  detail: string;
  repo: string;
  at: string;
  prId?: string;
  prNumber?: number;
  branchName?: string;
  action: "open" | "promote_codex" | "mark_ready" | "open_radar";
  actionLabel: string;
  score: number;
}

type NotificationScope = "unread" | "all" | "risk" | "ai";

const scopeTabs: Array<{ id: NotificationScope; label: string }> = [
  { id: "unread", label: "Unread" },
  { id: "all", label: "All" },
  { id: "risk", label: "Risk" },
  { id: "ai", label: "AI" },
];

export function NotificationCenter({
  open,
  signals,
  seenSignalIds,
  onClose,
  onMarkSeen,
  onMarkAllSeen,
  onOpenPullRequest,
  onOpenRepo,
  onPromoteCodex,
  onMarkReady,
  onOpenChangeRadar,
}: NotificationCenterProps) {
  const [scope, setScope] = useState<NotificationScope>("unread");
  const seen = useMemo(() => new Set(seenSignalIds), [seenSignalIds]);
  const unread = signals.filter((signal) => !seen.has(signal.id));
  const risk = signals.filter((signal) => signal.tone === "red" || signal.tone === "amber");
  const ai = signals.filter((signal) => signal.kind === "codex");
  const visibleSignals = filterSignals(signals, scope, seen).slice(0, 12);
  const currentUnreadIds = visibleSignals.filter((signal) => !seen.has(signal.id)).map((signal) => signal.id);
  const headline = headlineForScope(scope, signals.length, unread.length, risk.length, ai.length);

  if (!open) return null;

  const runSignal = (signal: NotificationSignal) => {
    onMarkSeen(signal.id);

    if (signal.action === "promote_codex" && signal.prId) {
      onPromoteCodex(signal.prId);
      return;
    }

    if (signal.action === "mark_ready" && signal.prId) {
      onMarkReady(signal.prId);
      return;
    }

    if (signal.action === "open_radar") {
      onOpenChangeRadar();
      return;
    }

    if (signal.prId) {
      onOpenPullRequest(signal.repo, signal.prId);
      return;
    }

    onOpenRepo(signal.repo);
  };

  return (
    <div className="notification-popover" data-testid="notification-center" role="dialog" aria-label="Notification center">
      <div className="notification-head">
        <div>
          <span>Notification center</span>
          <h2>{headline}</h2>
        </div>
        <div className="notification-head-actions">
          <button type="button" onClick={() => onMarkAllSeen(currentUnreadIds)} disabled={!currentUnreadIds.length} data-testid="notification-mark-seen">
            <CheckCircle2 size={14} />
            Mark seen
          </button>
          <button type="button" onClick={onClose} aria-label="Close notifications" data-testid="notification-close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="notification-metrics" aria-label="Notification metrics">
        <NotificationMetric icon={Bell} label="Unread" value={unread.length} tone={unread.length ? "blue" : "green"} />
        <NotificationMetric icon={ShieldAlert} label="Risk" value={risk.length} tone={risk.length ? "red" : "green"} />
        <NotificationMetric icon={Bot} label="AI" value={ai.length} tone={ai.length ? "purple" : "green"} />
      </div>

      <div className="notification-tabs" role="tablist" aria-label="Notification scopes">
        {scopeTabs.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={scope === tab.id}
            className={scope === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => setScope(tab.id)}
            data-testid={`notification-scope-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="notification-list">
        {visibleSignals.map((signal) => (
          <article className={`notification-item signal-${signal.tone} ${seen.has(signal.id) ? "seen" : ""}`} key={signal.id}>
            <button type="button" className="notification-main" onClick={() => runSignal(signal)}>
              <span className="notification-icon">
                <NotificationIcon signal={signal} />
              </span>
              <span className="notification-copy">
                <strong>{signal.title}</strong>
                <small>{signal.detail}</small>
              </span>
            </button>
            <div className="notification-meta">
              <span>{signal.repo}</span>
              <em>{formatRelativeTime(signal.at)}</em>
              <button type="button" onClick={() => runSignal(signal)}>{signal.actionLabel}</button>
            </div>
          </article>
        ))}

        {!visibleSignals.length && (
          <div className="notification-empty">
            <CheckCircle2 size={18} />
            <strong>No signals in this scope</strong>
            <span>Open all signals or wait for the next CI, Codex, branch, or review event.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: NotificationSignal["tone"];
}) {
  return (
    <div className={`notification-metric metric-${tone}`}>
      <Icon size={14} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function NotificationIcon({ signal }: { signal: NotificationSignal }) {
  if (signal.kind === "branch") return <GitBranch size={15} />;
  if (signal.kind === "ci") return <AlertTriangle size={15} />;
  if (signal.kind === "codex") return <Sparkles size={15} />;
  if (signal.kind === "ready") return <ThumbsUp size={15} />;
  return <GitPullRequest size={15} />;
}

function filterSignals(signals: NotificationSignal[], scope: NotificationScope, seen: Set<string>) {
  if (scope === "unread") return signals.filter((signal) => !seen.has(signal.id));
  if (scope === "risk") return signals.filter((signal) => signal.tone === "red" || signal.tone === "amber");
  if (scope === "ai") return signals.filter((signal) => signal.kind === "codex");
  return signals;
}

function headlineForScope(scope: NotificationScope, total: number, unread: number, risk: number, ai: number) {
  if (scope === "all") return total ? `${total} total signals` : "No signals yet";
  if (scope === "risk") return risk ? `${risk} risk signals` : "No risk signals";
  if (scope === "ai") return ai ? `${ai} AI signals` : "No AI signals";
  return unread ? `${unread} live signals` : "All caught up";
}

export function buildNotificationSignals(
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  reviewMemory: ReviewMemoryByPr,
): NotificationSignal[] {
  const signals: NotificationSignal[] = [];
  const pullRequestByBranch = new Map(pullRequests.map((pr) => [`${pr.repo}:${pr.branch}`, pr]));

  pullRequests
    .filter((pr) => pr.state !== "merged")
    .forEach((pr, index) => {
      const memory = reviewMemory[pr.id];
      const intel = getPrIntelligence(pr, index);
      const at = pr.codex.lastSeenAt ?? pr.updatedAt;

      if (pr.ci === "failure") {
        signals.push({
          id: `ci-${pr.id}-${pr.updatedAt}`,
          kind: "ci",
          tone: "red",
          title: `#${pr.number} CI is failing`,
          detail: `${pr.ciSummary}; inspect before the queue moves.`,
          repo: pr.repo,
          at: pr.updatedAt,
          prId: pr.id,
          prNumber: pr.number,
          action: "open",
          actionLabel: "Inspect",
          score: 96,
        });
      }

      if (pr.state === "changes_requested") {
        signals.push({
          id: `review-${pr.id}-${pr.updatedAt}`,
          kind: "review",
          tone: "red",
          title: `#${pr.number} has requested changes`,
          detail: `${pr.author.login} needs a fix path before this can move.`,
          repo: pr.repo,
          at: pr.updatedAt,
          prId: pr.id,
          prNumber: pr.number,
          action: "open",
          actionLabel: "Open",
          score: 91,
        });
      }

      if (pr.codex.reaction === "changed") {
        signals.push({
          id: `codex-changed-${pr.id}-${at}`,
          kind: "codex",
          tone: "purple",
          title: `#${pr.number} Codex signal changed`,
          detail: pr.codex.statusText,
          repo: pr.repo,
          at,
          prId: pr.id,
          prNumber: pr.number,
          action: "open",
          actionLabel: "Review",
          score: 88,
        });
      } else if (pr.codex.reaction === "eyes") {
        signals.push({
          id: `codex-eyes-${pr.id}-${at}`,
          kind: "codex",
          tone: "amber",
          title: `#${pr.number} Codex is still watching`,
          detail: "Promote the AI review once it moves from eyes to thumbs up.",
          repo: pr.repo,
          at,
          prId: pr.id,
          prNumber: pr.number,
          action: "promote_codex",
          actionLabel: "Promote",
          score: 76,
        });
      } else if (!pr.codex.exists && !pr.isDraft) {
        signals.push({
          id: `codex-missing-${pr.id}-${pr.updatedAt}`,
          kind: "codex",
          tone: "amber",
          title: `#${pr.number} needs AI coverage`,
          detail: "No Codex review signal has been seen yet.",
          repo: pr.repo,
          at: pr.updatedAt,
          prId: pr.id,
          prNumber: pr.number,
          action: "open_radar",
          actionLabel: "Radar",
          score: 70,
        });
      }

      if (intel.readiness >= intel.readinessTotal - 1 && pr.ci === "success" && !pr.isDraft && memory?.decision !== "blocked") {
        signals.push({
          id: `ready-${pr.id}-${memory?.updatedAt ?? pr.updatedAt}`,
          kind: "ready",
          tone: "green",
          title: `#${pr.number} is near merge-ready`,
          detail: `${intel.readiness}/${intel.readinessTotal} gates ready; queue estimate ${intel.queueEstimate}.`,
          repo: pr.repo,
          at: memory?.updatedAt ?? pr.updatedAt,
          prId: pr.id,
          prNumber: pr.number,
          action: "mark_ready",
          actionLabel: "Ready",
          score: 62,
        });
      }
    });

  branches
    .filter((branch) => branch.health === "behind" || branch.health === "diverged" || branch.health === "stale")
    .forEach((branch) => {
      const pr = branch.pullRequestNumber
        ? pullRequests.find((item) => item.repo === branch.repo && item.number === branch.pullRequestNumber)
        : pullRequestByBranch.get(`${branch.repo}:${branch.name}`);
      const blocked = branch.health === "diverged" || branch.health === "behind";

      signals.push({
        id: `branch-${branch.id}-${branch.updatedAt}-${branch.health}`,
        kind: "branch",
        tone: blocked ? "red" : "amber",
        title: `${branch.name} is ${branch.health}`,
        detail: `Branch is +${branch.ahead} / -${branch.behind} against base.`,
        repo: branch.repo,
        at: branch.updatedAt,
        prId: pr?.id,
        prNumber: pr?.number,
        branchName: branch.name,
        action: "open",
        actionLabel: pr ? "Open PR" : "Open repo",
        score: blocked ? 82 : 58,
      });
    });

  return signals
    .sort((a, b) => b.score - a.score || new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);
}
