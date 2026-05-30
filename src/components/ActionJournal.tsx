import { useMemo, useState } from "react";
import {
  Bell,
  Bot,
  CheckCircle2,
  Clipboard,
  GitMerge,
  History,
  PlugZap,
  RadioTower,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { ActionJournalEntry, ActionJournalScope, ActivityEvent } from "../types";
import { formatRelativeTime } from "./ui";

interface ActionJournalProps {
  entries: ActionJournalEntry[];
  activity: ActivityEvent[];
  activeRepo: string;
  onCopyJournal: (text: string, count: number) => void;
  onClearJournal: () => void;
  onOpenAttentionInbox: () => void;
  onOpenDecisionSimulator: () => void;
}

interface JournalScopeMeta {
  label: string;
  icon: LucideIcon;
}

const scopeMeta: Record<ActionJournalScope | "all", JournalScopeMeta> = {
  all: { label: "All", icon: History },
  decision: { label: "Decision", icon: Sparkles },
  attention: { label: "Attention", icon: Bell },
  review: { label: "Review", icon: Target },
  ship: { label: "Ship", icon: GitMerge },
  ai: { label: "AI", icon: Bot },
  ops: { label: "Ops", icon: RadioTower },
  connection: { label: "Connect", icon: PlugZap },
  system: { label: "System", icon: CheckCircle2 },
};

const scopeOrder: Array<ActionJournalScope | "all"> = [
  "all",
  "decision",
  "attention",
  "review",
  "ship",
  "ai",
  "ops",
  "connection",
];

export function ActionJournal({
  entries,
  activity,
  activeRepo,
  onCopyJournal,
  onClearJournal,
  onOpenAttentionInbox,
  onOpenDecisionSimulator,
}: ActionJournalProps) {
  const [activeScope, setActiveScope] = useState<ActionJournalScope | "all">("all");
  const visibleEntries = useMemo(
    () => entries.filter((entry) => activeScope === "all" || entry.scope === activeScope).slice(0, 12),
    [activeScope, entries],
  );
  const counts = useMemo(() => buildScopeCounts(entries), [entries]);
  const handoff = formatJournalHandoff(entries, activeRepo);
  const latest = entries[0];
  const shipCount = entries.filter((entry) => entry.scope === "ship" || entry.message.toLowerCase().includes("merge")).length;
  const aiCount = entries.filter((entry) => entry.scope === "ai").length;
  const reviewCount = entries.filter((entry) => entry.scope === "review").length;

  return (
    <section className="action-journal" id="action-journal" data-testid="action-journal">
      <div className="journal-head">
        <div>
          <span>Decision journal</span>
          <h2>{entries.length ? `${entries.length} recorded moves in workspace memory` : "Workspace memory is ready"}</h2>
          <p>
            Persistent audit trail for plans, PR decisions, Codex moves, copied handoffs, and operational changes.
          </p>
        </div>
        <div className="journal-actions">
          <button type="button" onClick={onOpenDecisionSimulator}>
            <Sparkles size={14} />
            Simulate next
          </button>
          <button type="button" onClick={onOpenAttentionInbox}>
            <Bell size={14} />
            Open signals
          </button>
          <button type="button" onClick={() => onCopyJournal(handoff, entries.length)} data-testid="journal-copy-handoff">
            <Clipboard size={14} />
            Copy handoff
          </button>
          <button type="button" onClick={onClearJournal} data-testid="journal-clear">
            <Trash2 size={14} />
            Clear
          </button>
        </div>
      </div>

      <div className="journal-metrics" aria-label="Journal metrics">
        <JournalMetric label="Recorded" value={entries.length} detail={latest ? formatRelativeTime(latest.createdAt) : "none yet"} tone={entries.length ? "blue" : "amber"} />
        <JournalMetric label="Ship moves" value={shipCount} detail="merge lane" tone={shipCount ? "green" : "blue"} />
        <JournalMetric label="AI moves" value={aiCount} detail="Codex lane" tone={aiCount ? "purple" : "blue"} />
        <JournalMetric label="Reviews" value={reviewCount} detail="focus lane" tone={reviewCount ? "amber" : "blue"} />
      </div>

      <div className="journal-scopes" role="tablist" aria-label="Journal scopes">
        {scopeOrder.map((scope) => {
          const Icon = scopeMeta[scope].icon;

          return (
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === scope}
              className={activeScope === scope ? "active" : ""}
              key={scope}
              onClick={() => setActiveScope(scope)}
              data-testid={`journal-scope-${scope}`}
            >
              <Icon size={14} />
              <span>{scopeMeta[scope].label}</span>
              <b>{counts[scope]}</b>
            </button>
          );
        })}
      </div>

      <div className="journal-body">
        <div className="journal-list">
          {visibleEntries.map((entry) => {
            const Icon = scopeMeta[entry.scope].icon;

            return (
              <article className={`journal-entry journal-${entry.tone}`} key={entry.id}>
                <span className="journal-entry-icon">
                  <Icon size={15} />
                </span>
                <div className="journal-entry-main">
                  <strong>{entry.message}</strong>
                  <span>
                    {scopeMeta[entry.scope].label}
                    {entry.repo ? ` · ${entry.repo}` : ""}
                    {entry.prNumber ? ` · #${entry.prNumber}` : ""}
                    {" · "}
                    {formatRelativeTime(entry.createdAt)}
                  </span>
                </div>
                <em>{entry.scope}</em>
              </article>
            );
          })}

          {!visibleEntries.length && (
            <div className="journal-empty">
              <History size={17} />
              <strong>No journal entries in this scope.</strong>
              <span>Run a plan, acknowledge a signal, copy a brief, or queue a merge to start the audit trail.</span>
            </div>
          )}
        </div>

        <aside className="journal-handoff">
          <div className="journal-section-title">
            <Clipboard size={15} />
            <strong>Handoff preview</strong>
            <span>{Math.min(entries.length, 6)} lines</span>
          </div>
          <div className="journal-handoff-card">
            <strong>{activeRepo}</strong>
            <span>{latest ? latest.message : "No recorded actions yet."}</span>
            <small>{latest ? formatRelativeTime(latest.createdAt) : "Start with Decision Simulator or Attention Inbox."}</small>
          </div>

          <div className="journal-section-title">
            <ShieldAlert size={15} />
            <strong>External feed</strong>
          </div>
          <div className="journal-feed">
            {activity.slice(0, 4).map((event) => (
              <div key={event.id}>
                <i className={`journal-feed-dot feed-${event.state}`} />
                <span>
                  <strong>{event.title}</strong>
                  <small>{event.detail}</small>
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function JournalMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: "blue" | "green" | "amber" | "purple";
}) {
  return (
    <div className={`journal-metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function buildScopeCounts(entries: ActionJournalEntry[]) {
  return entries.reduce<Record<ActionJournalScope | "all", number>>(
    (counts, entry) => ({
      ...counts,
      all: counts.all + 1,
      [entry.scope]: counts[entry.scope] + 1,
    }),
    {
      all: 0,
      decision: 0,
      attention: 0,
      review: 0,
      ship: 0,
      ai: 0,
      ops: 0,
      connection: 0,
      system: 0,
    },
  );
}

function formatJournalHandoff(entries: ActionJournalEntry[], activeRepo: string) {
  return [
    `GitTrack decision journal · ${activeRepo}`,
    `Generated ${new Date().toLocaleString()}`,
    "",
    ...(entries.length
      ? entries.slice(0, 12).map((entry, index) => `${index + 1}. [${entry.scope}] ${entry.message}`)
      : ["No recorded actions yet."]),
  ].join("\n");
}
