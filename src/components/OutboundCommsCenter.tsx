import { useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Clipboard,
  FileText,
  Inbox,
  MessageSquareText,
  RadioTower,
  Send,
  Sparkles,
  TimerReset,
  Users,
  type LucideIcon,
} from "lucide-react";
import type {
  DigestComposerAudience,
  DigestComposerMode,
  OutboundUpdate,
  OutboundUpdateStatus,
  PullRequestSummary,
} from "../types";
import { formatRelativeTime, StatusPill } from "./ui";

interface OutboundCommsCenterProps {
  updates: OutboundUpdate[];
  pullRequests: PullRequestSummary[];
  onCopyUpdate: (id: string, body: string) => void;
  onStatusChange: (id: string, status: OutboundUpdateStatus) => void;
  onOpenDailyDigest: () => void;
  onOpenPullRequest: (repo: string, id: string) => void;
  onClearSent: () => void;
}

type OutboxFilter = OutboundUpdateStatus | "all";

interface StatusConfig {
  id: OutboxFilter;
  label: string;
  detail: string;
  icon: LucideIcon;
}

const statusConfigs: StatusConfig[] = [
  { id: "all", label: "All", detail: "complete lane", icon: Inbox },
  { id: "drafted", label: "Drafted", detail: "needs routing", icon: FileText },
  { id: "queued", label: "Queued", detail: "ready to send", icon: TimerReset },
  { id: "sent", label: "Sent", detail: "delivered", icon: CheckCircle2 },
  { id: "archived", label: "Archived", detail: "closed out", icon: Archive },
];

const channelLabels: Record<DigestComposerMode, string> = {
  slack: "Slack",
  standup: "Standup",
  release: "Release",
  executive: "Executive",
};

const audienceLabels: Record<DigestComposerAudience, string> = {
  self: "Self",
  team: "Team",
  leadership: "Leadership",
};

export function OutboundCommsCenter({
  updates,
  pullRequests,
  onCopyUpdate,
  onStatusChange,
  onOpenDailyDigest,
  onOpenPullRequest,
  onClearSent,
}: OutboundCommsCenterProps) {
  const [activeFilter, setActiveFilter] = useState<OutboxFilter>("all");
  const [selectedId, setSelectedId] = useState<string>();
  const counts = useMemo(() => buildStatusCounts(updates), [updates]);
  const visibleUpdates = useMemo(
    () => updates.filter((update) => activeFilter === "all" || update.status === activeFilter),
    [activeFilter, updates],
  );
  const selectedUpdate =
    updates.find((update) => update.id === selectedId) ??
    visibleUpdates[0] ??
    updates[0];
  const relatedPullRequests = selectedUpdate
    ? selectedUpdate.relatedPrIds
        .map((id) => pullRequests.find((pr) => pr.id === id))
        .filter((pr): pr is PullRequestSummary => Boolean(pr))
        .slice(0, 3)
    : [];
  const latestActive = updates.find((update) => update.status !== "archived");
  const openCount = counts.drafted + counts.queued;
  const oldestOpen = updates
    .filter((update) => update.status === "drafted" || update.status === "queued")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

  return (
    <section className="outbox-center" id="outbound-comms" data-testid="outbound-comms">
      <div className="outbox-head">
        <div>
          <span>Comms outbox</span>
          <h2>{openCount ? `${openCount} outbound updates need a finish` : "Outbound lane is clear"}</h2>
          <p>Copied digests become tracked handoffs with routing, status, evidence, and a send-ready audit trail.</p>
        </div>
        <div className="outbox-actions">
          <button type="button" onClick={onOpenDailyDigest}>
            <Sparkles size={14} />
            Compose digest
          </button>
          <button
            type="button"
            onClick={() => latestActive && onCopyUpdate(latestActive.id, latestActive.body)}
            disabled={!latestActive}
            data-testid="outbox-copy-latest"
          >
            <Clipboard size={14} />
            Copy latest
          </button>
          <button type="button" onClick={onClearSent}>
            <Archive size={14} />
            Clear sent
          </button>
        </div>
      </div>

      <div className="outbox-metrics" aria-label="Outbox metrics">
        <OutboxMetric label="Drafted" value={counts.drafted} detail="needs routing" tone={counts.drafted ? "amber" : "green"} icon={FileText} />
        <OutboxMetric label="Queued" value={counts.queued} detail="ready to send" tone={counts.queued ? "blue" : "green"} icon={TimerReset} />
        <OutboxMetric label="Sent" value={counts.sent} detail="delivered" tone={counts.sent ? "green" : "blue"} icon={Send} />
        <OutboxMetric label="Oldest open" value={oldestOpen ? formatRelativeTime(oldestOpen.createdAt) : "clear"} detail={`${updates.length} total`} tone={oldestOpen ? "purple" : "green"} icon={RadioTower} />
      </div>

      <div className="outbox-tabs" role="tablist" aria-label="Outbound update status">
        {statusConfigs.map((status) => {
          const Icon = status.icon;
          const count = status.id === "all" ? updates.length : counts[status.id];

          return (
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === status.id}
              className={activeFilter === status.id ? "active" : ""}
              key={status.id}
              onClick={() => setActiveFilter(status.id)}
              data-testid={`outbox-filter-${status.id}`}
            >
              <Icon size={14} />
              <span>
                <strong>{status.label}</strong>
                <small>{status.detail}</small>
              </span>
              <b>{count}</b>
            </button>
          );
        })}
      </div>

      <div className="outbox-body">
        <div className="outbox-list">
          {visibleUpdates.map((update) => (
            <button
              type="button"
              className={`outbox-card outbox-${update.status} ${selectedUpdate?.id === update.id ? "selected" : ""}`}
              key={update.id}
              onClick={() => setSelectedId(update.id)}
            >
              <span className="outbox-card-main">
                <strong>{update.title}</strong>
                <small>{update.summary}</small>
              </span>
              <span className="outbox-card-meta">
                <em>{channelLabels[update.channel]}</em>
                <em>{audienceLabels[update.audience]}</em>
                <b>{update.status}</b>
              </span>
              <span className="outbox-card-foot">
                <small>{formatRelativeTime(update.createdAt)}</small>
                <small>{update.lineCount} lines</small>
                <small>{update.sourceCount} sources</small>
              </span>
            </button>
          ))}

          {!visibleUpdates.length && (
            <div className="outbox-empty">
              <Inbox size={17} />
              <strong>No updates in this lane.</strong>
              <span>Copy a daily digest to create a tracked outbound update.</span>
              <button type="button" onClick={onOpenDailyDigest}>Compose digest</button>
            </div>
          )}
        </div>

        <aside className="outbox-preview">
          <div className="outbox-section-title">
            <MessageSquareText size={15} />
            <strong>Delivery preview</strong>
            <span>{selectedUpdate ? selectedUpdate.status : "empty"}</span>
          </div>

          {selectedUpdate ? (
            <>
              <div className="outbox-preview-card">
                <div>
                  <strong>{selectedUpdate.title}</strong>
                  <span>{channelLabels[selectedUpdate.channel]} · {audienceLabels[selectedUpdate.audience]} · {formatRelativeTime(selectedUpdate.updatedAt)}</span>
                </div>
                <pre>{selectedUpdate.body}</pre>
                <div className="outbox-preview-actions">
                  <button type="button" onClick={() => onCopyUpdate(selectedUpdate.id, selectedUpdate.body)} data-testid="outbox-copy-selected">
                    <Clipboard size={14} />
                    Copy
                  </button>
                  {selectedUpdate.status !== "queued" && selectedUpdate.status !== "sent" && (
                    <button type="button" onClick={() => onStatusChange(selectedUpdate.id, "queued")} data-testid="outbox-queue-selected">
                      <TimerReset size={14} />
                      Queue
                    </button>
                  )}
                  {selectedUpdate.status !== "sent" && (
                    <button type="button" onClick={() => onStatusChange(selectedUpdate.id, "sent")} data-testid="outbox-send-selected">
                      <Send size={14} />
                      Mark sent
                    </button>
                  )}
                  {selectedUpdate.status !== "archived" && (
                    <button type="button" onClick={() => onStatusChange(selectedUpdate.id, "archived")}>
                      <Archive size={14} />
                      Archive
                    </button>
                  )}
                </div>
              </div>

              <div className="outbox-related">
                <div className="outbox-section-title">
                  <Users size={15} />
                  <strong>Referenced PRs</strong>
                  <span>{relatedPullRequests.length}</span>
                </div>
                {relatedPullRequests.map((pr) => (
                  <button type="button" key={pr.id} onClick={() => onOpenPullRequest(pr.repo, pr.id)}>
                    <span>
                      <strong>#{pr.number} {pr.title}</strong>
                      <small>{pr.repo} · {pr.ciSummary}</small>
                    </span>
                    <StatusPill state={pr.state} />
                  </button>
                ))}
                {!relatedPullRequests.length && <p>No PR references were detected in this update.</p>}
              </div>
            </>
          ) : (
            <div className="outbox-empty outbox-empty-preview">
              <Inbox size={17} />
              <strong>Nothing queued yet.</strong>
              <span>Generate a daily digest and copy it to seed the comms lane.</span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function OutboxMetric({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: "blue" | "green" | "amber" | "red" | "purple";
  icon: LucideIcon;
}) {
  return (
    <div className={`outbox-metric metric-${tone}`}>
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function buildStatusCounts(updates: OutboundUpdate[]) {
  return updates.reduce<Record<OutboundUpdateStatus, number>>(
    (counts, update) => ({
      ...counts,
      [update.status]: counts[update.status] + 1,
    }),
    {
      drafted: 0,
      queued: 0,
      sent: 0,
      archived: 0,
    },
  );
}
