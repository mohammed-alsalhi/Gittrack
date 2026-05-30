import {
  BellOff,
  Bot,
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  GitPullRequest,
  RadioTower,
  ScanEye,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  TimerReset,
} from "lucide-react";
import {
  CodexReaction,
  CodexSignalMemoryByPr,
  CodexSignalMemoryStatus,
  PullRequestSummary,
  ReviewEvent,
} from "../types";
import { CiBadge, CodexBadge, formatRelativeTime, StatusPill } from "./ui";

interface CodexSignalTrackerProps {
  repo: string;
  pullRequests: PullRequestSummary[];
  signalMemory: CodexSignalMemoryByPr;
  selectedId?: string;
  onSelectPullRequest: (id: string) => void;
  onUpdateSignalStatus: (id: string, status: CodexSignalMemoryStatus) => void;
  onPromoteCodex: (id: string) => void;
  onCopySweep: (text: string, count: number) => void;
}

type SignalStatus = "changed" | "approved" | "watching" | "missing";

interface SignalItem {
  pr: PullRequestSummary;
  status: SignalStatus;
  memoryStatus: CodexSignalMemoryStatus;
  title: string;
  detail: string;
  lastSeenAt?: string;
  firstReaction: CodexReaction;
  latestReaction: CodexReaction;
  score: number;
}

export function CodexSignalTracker({
  repo,
  pullRequests,
  signalMemory,
  selectedId,
  onSelectPullRequest,
  onUpdateSignalStatus,
  onPromoteCodex,
  onCopySweep,
}: CodexSignalTrackerProps) {
  const items = pullRequests
    .filter((pr) => pr.state !== "merged")
    .map((pr) => buildSignalItem(pr, signalMemory))
    .sort((a, b) => signalScore(b) - signalScore(a));
  const visible = items.slice(0, 7);
  const changed = items.filter((item) => item.status === "changed").length;
  const approved = items.filter((item) => item.status === "approved").length;
  const watching = items.filter((item) => item.status === "watching").length;
  const missing = items.filter((item) => item.status === "missing").length;
  const openAlerts = items.filter((item) => item.memoryStatus === "open" && item.status !== "approved").length;
  const focusItem = items.find((item) => item.pr.id === selectedId) ?? items[0];
  const sweepText = formatCodexSweep(repo, items);
  const headline = openAlerts
    ? `${openAlerts} Codex signals need a decision`
    : changed
      ? `${changed} Codex reaction ${pluralize("change", changed)} acknowledged`
      : "Codex signal lane is clean";

  return (
    <section className="codex-signal-tracker" data-testid="codex-signal-tracker">
      <div className="signal-head">
        <div>
          <span>Codex signal watch</span>
          <h2>{headline}</h2>
          <p>Tracks missing AI sweeps, eyes-only reviews, and eyes to thumbs-up transitions across this repo.</p>
        </div>
        <div className="signal-actions">
          <button type="button" onClick={() => onCopySweep(sweepText, items.length)} data-testid="copy-codex-sweep">
            <Copy size={14} />
            Copy sweep
          </button>
          <button type="button" className="signal-primary" onClick={() => focusItem && onPromoteCodex(focusItem.pr.id)} disabled={!focusItem}>
            <Sparkles size={14} />
            Promote focus
          </button>
        </div>
      </div>

      <div className="signal-metric-strip" aria-label="Codex signal summary">
        <SignalMetric label="Changed" value={changed} tone={changed ? "green" : "blue"} />
        <SignalMetric label="Approved" value={approved} tone="green" />
        <SignalMetric label="Watching" value={watching} tone={watching ? "amber" : "green"} />
        <SignalMetric label="Missing" value={missing} tone={missing ? "red" : "green"} />
      </div>

      <div className="signal-body">
        <div className="signal-queue">
          <div className="signal-section-title">
            <RadioTower size={15} />
            <strong>Signal queue</strong>
            <span>{visible.length} PRs scanned</span>
          </div>

          <div className="signal-row-list">
            {visible.map((item) => (
              <div
                className={`signal-row signal-${item.status} memory-${item.memoryStatus} ${item.pr.id === selectedId ? "selected" : ""}`}
                key={item.pr.id}
              >
                <button type="button" className="signal-row-main" onClick={() => onSelectPullRequest(item.pr.id)}>
                  <span className="signal-kind-icon">{iconForStatus(item.status)}</span>
                  <span className="signal-copy">
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <span className="signal-pr-meta">
                    <CodexBadge reaction={item.pr.codex.reaction} compact />
                    <StatusPill state={item.pr.state} />
                    <CiBadge state={item.pr.ci} />
                  </span>
                </button>

                <div className="signal-row-foot">
                  <span>
                    <TimerReset size={13} />
                    {formatLastSeen(item)}
                  </span>
                  <span>
                    <ClipboardList size={13} />
                    {item.pr.codex.events.length} {pluralize("event", item.pr.codex.events.length)}
                  </span>
                  <button type="button" onClick={() => onUpdateSignalStatus(item.pr.id, "acknowledged")} data-testid={`ack-codex-${item.pr.number}`}>
                    <CheckCircle2 size={13} />
                    Ack
                  </button>
                  <button type="button" onClick={() => onPromoteCodex(item.pr.id)} data-testid={`promote-codex-${item.pr.number}`}>
                    <ThumbsUp size={13} />
                    Promote
                  </button>
                  <button type="button" onClick={() => onUpdateSignalStatus(item.pr.id, "muted")} aria-label={`Mute Codex signal for #${item.pr.number}`}>
                    <BellOff size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="signal-ledger">
          <div className="signal-section-title">
            <ScanEye size={15} />
            <strong>Reaction ledger</strong>
            <span>{focusItem ? `#${focusItem.pr.number}` : "None"}</span>
          </div>

          {focusItem ? (
            <div className="signal-ledger-card">
              <span>{focusItem.pr.codex.statusText}</span>
              <strong>
                {reactionLabel(focusItem.firstReaction)} → {reactionLabel(focusItem.latestReaction)}
              </strong>
              <p>{focusItem.pr.title}</p>
              <div className="signal-event-list">
                {focusItem.pr.codex.events.length ? (
                  focusItem.pr.codex.events.map((event) => <SignalEventRow event={event} key={event.id} />)
                ) : (
                  <div className="signal-empty">
                    <Bot size={15} />
                    No Codex event recorded.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="signal-empty">
              <CheckCircle2 size={15} />
              No pull requests to inspect.
            </div>
          )}
        </aside>

        <aside className="signal-policy">
          <div className="signal-section-title">
            <ShieldCheck size={15} />
            <strong>Automation policy</strong>
          </div>
          <div className="signal-policy-grid">
            <PolicyItem label="Eyes" value={`${watching} watching`} tone={watching ? "amber" : "green"} />
            <PolicyItem label="Thumbs up" value={`${approved + changed} approved`} tone="green" />
            <PolicyItem label="Muted" value={`${items.filter((item) => item.memoryStatus === "muted").length} quiet`} tone="blue" />
          </div>
          <div className="signal-next-card">
            <span>Next signal</span>
            <strong>{items.find((item) => item.memoryStatus === "open" && item.status !== "approved")?.title ?? "No action waiting"}</strong>
            <p>{items.find((item) => item.memoryStatus === "open" && item.status !== "approved")?.detail ?? "Codex reactions are either approved, acknowledged, or intentionally muted."}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SignalMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "amber" | "red";
}) {
  return (
    <div className={`signal-metric metric-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PolicyItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "amber";
}) {
  return (
    <div className={`policy-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SignalEventRow({ event }: { event: ReviewEvent }) {
  return (
    <div className={`signal-event-row event-${event.reaction}`}>
      <span>{iconForReaction(event.reaction)}</span>
      <strong>{reactionLabel(event.reaction)}</strong>
      <em>{formatRelativeTime(event.submittedAt)}</em>
    </div>
  );
}

function buildSignalItem(
  pr: PullRequestSummary,
  signalMemory: CodexSignalMemoryByPr,
): SignalItem {
  const status = statusForPr(pr);
  const latestEvent = latestCodexEvent(pr.codex.events);
  const firstEvent = pr.codex.events[0];
  const memoryStatus = signalMemory[pr.id]?.status ?? defaultMemoryStatus(status);
  const firstReaction = firstEvent?.reaction ?? "none";
  const latestReaction = latestEvent?.reaction ?? pr.codex.reaction;

  return {
    pr,
    status,
    memoryStatus,
    title: `#${pr.number} ${pr.title.replace(/^feat: |^fix: |^chore: |^docs: /, "")}`,
    detail: detailForStatus(pr, status, memoryStatus),
    lastSeenAt: pr.codex.lastSeenAt ?? latestEvent?.submittedAt,
    firstReaction,
    latestReaction,
    score:
      (status === "changed" ? 90 : status === "missing" ? 78 : status === "watching" ? 70 : 24) +
      (memoryStatus === "open" ? 12 : memoryStatus === "muted" ? -34 : -18) +
      (pr.ci === "success" ? 4 : 0),
  };
}

function statusForPr(pr: PullRequestSummary): SignalStatus {
  if (!pr.codex.exists) return "missing";
  if (pr.codex.reaction === "changed") return "changed";
  if (pr.codex.reaction === "thumbs_up") return "approved";
  if (pr.codex.reaction === "eyes") return "watching";
  return "missing";
}

function defaultMemoryStatus(status: SignalStatus): CodexSignalMemoryStatus {
  return status === "approved" ? "acknowledged" : "open";
}

function detailForStatus(
  pr: PullRequestSummary,
  status: SignalStatus,
  memoryStatus: CodexSignalMemoryStatus,
) {
  const suffix = memoryStatus === "muted" ? " · muted" : memoryStatus === "acknowledged" ? " · acknowledged" : "";
  if (status === "changed") return `${pr.codex.statusText}; verify the diff before treating it as final${suffix}.`;
  if (status === "approved") return `${pr.codex.statusText}; last seen ${formatRelativeTime(pr.codex.lastSeenAt)}${suffix}.`;
  if (status === "watching") return `${pr.codex.statusText}; still waiting for approval reaction${suffix}.`;
  return `No Codex review signal found; request a sweep before merge${suffix}.`;
}

function signalScore(item: SignalItem) {
  return item.score;
}

function latestCodexEvent(events: ReviewEvent[]) {
  return [...events].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
}

function formatLastSeen(item: SignalItem) {
  return item.lastSeenAt ? `Seen ${formatRelativeTime(item.lastSeenAt)}` : "Never seen";
}

function iconForStatus(status: SignalStatus) {
  if (status === "changed") return <Sparkles size={15} />;
  if (status === "approved") return <ThumbsUp size={15} />;
  if (status === "watching") return <Eye size={15} />;
  return <Bot size={15} />;
}

function iconForReaction(reaction: CodexReaction) {
  if (reaction === "eyes") return <Eye size={13} />;
  if (reaction === "thumbs_up" || reaction === "changed") return <ThumbsUp size={13} />;
  return <GitPullRequest size={13} />;
}

function reactionLabel(reaction: CodexReaction) {
  if (reaction === "thumbs_up") return "Thumbs up";
  if (reaction === "changed") return "Eyes to thumbs up";
  if (reaction === "eyes") return "Eyes";
  return "None";
}

function formatCodexSweep(repo: string, items: SignalItem[]) {
  const active = items.filter((item) => item.status !== "approved" && item.memoryStatus !== "muted");

  return [
    `Codex signal sweep · ${repo}`,
    `Open signals: ${active.length}`,
    "",
    ...(active.length
      ? active.map((item) => `- ${item.title}: ${item.pr.codex.statusText} (${item.memoryStatus})`)
      : ["- No open Codex signals."]),
  ].join("\n");
}

function pluralize(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}
