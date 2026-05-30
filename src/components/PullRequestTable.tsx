import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Eye,
  ListFilter,
  SlidersHorizontal,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { PullRequestSummary, ReviewMemoryByPr } from "../types";
import { getPrIntelligence } from "../lib/insights";
import { AvatarStack, CiBadge, CodexBadge, formatRelativeTime, StatusPill } from "./ui";

interface PullRequestTableProps {
  pullRequests: PullRequestSummary[];
  selectedId?: string;
  reviewMemory: ReviewMemoryByPr;
  onSelect: (id: string) => void;
}

type InboxView = "open" | "draft" | "merged";
type InboxSort = "updated" | "risk" | "readiness";
type InboxDensity = "comfortable" | "compact";
type InboxColumnId = "stack" | "changed" | "risk" | "ai" | "state" | "ci" | "merge";

const tabs: Array<{ id: InboxView; label: string }> = [
  { id: "open", label: "Open" },
  { id: "draft", label: "Draft" },
  { id: "merged", label: "Merged" },
];

const sortCycle: InboxSort[] = ["updated", "risk", "readiness"];

const inboxColumnConfigs: Array<{
  id: InboxColumnId;
  label: string;
  description: string;
  desktopTrack: string;
  narrowTrack?: string;
}> = [
  { id: "stack", label: "Stack", description: "Stack position and lane", desktopTrack: "minmax(96px, 0.64fr)" },
  { id: "changed", label: "Changed", description: "Additions and deletions", desktopTrack: "74px", narrowTrack: "62px" },
  { id: "risk", label: "Risk", description: "Risk signal", desktopTrack: "64px", narrowTrack: "54px" },
  { id: "ai", label: "AI Review", description: "Codex review state", desktopTrack: "86px" },
  { id: "state", label: "State", description: "PR review state", desktopTrack: "108px", narrowTrack: "126px" },
  { id: "ci", label: "CI", description: "Reviewers and checks", desktopTrack: "62px" },
  { id: "merge", label: "Merge", description: "Readiness score", desktopTrack: "70px" },
];

const defaultInboxColumns = inboxColumnConfigs.reduce<Record<InboxColumnId, boolean>>((columns, column) => {
  columns[column.id] = true;
  return columns;
}, {} as Record<InboxColumnId, boolean>);

export function PullRequestTable({ pullRequests, selectedId, reviewMemory, onSelect }: PullRequestTableProps) {
  const [activeView, setActiveView] = useState<InboxView>("open");
  const [focusOnly, setFocusOnly] = useState(false);
  const [sortMode, setSortMode] = useState<InboxSort>("updated");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [density, setDensity] = useState<InboxDensity>("comfortable");
  const [visibleColumns, setVisibleColumns] = useState<Record<InboxColumnId, boolean>>(defaultInboxColumns);

  const inboxStats = useMemo(() => buildInboxStats(pullRequests), [pullRequests]);
  const visiblePullRequests = useMemo(
    () => sortPullRequests(filterPullRequests(pullRequests, activeView, focusOnly, reviewMemory), sortMode),
    [activeView, focusOnly, pullRequests, reviewMemory, sortMode],
  );
  const enabledColumns = inboxColumnConfigs.filter((column) => visibleColumns[column.id]);
  const enabledColumnCount = enabledColumns.length;
  const tableGridStyle = {
    "--inbox-grid": buildInboxGridTemplate(enabledColumns, "desktop"),
    "--inbox-grid-narrow": buildInboxGridTemplate(
      enabledColumns.filter((column) => column.narrowTrack),
      "narrow",
    ),
  } as CSSProperties;
  const getColumnClass = (column: InboxColumnId, className = "") =>
    [className, !visibleColumns[column] ? "inbox-column-hidden" : ""].filter(Boolean).join(" ");
  const activeLabel = tabs.find((tab) => tab.id === activeView)?.label ?? "Open";
  const focusCount = pullRequests.filter((pr, index) => isFocusPr(pr, index, reviewMemory)).length;
  const nextSort = sortCycle[(sortCycle.indexOf(sortMode) + 1) % sortCycle.length];
  const summaryCards = [
    { label: "Ready", value: inboxStats.ready, tone: "green" },
    { label: "Blocked", value: inboxStats.blocked, tone: "red" },
    { label: "AI pending", value: inboxStats.aiPending, tone: "amber" },
    { label: "Focus", value: focusCount, tone: "blue" },
  ] as const;

  return (
    <section className="pr-panel panel">
      <div className="table-toolbar">
        <div className="inbox-toolbar-title">
          <button className="inbox-toggle" type="button">
            <ChevronDown size={17} />
            <span className="inbox-count">{visiblePullRequests.length}</span>
            <Eye className="inbox-eyes" size={18} />
            <strong>Needs your review</strong>
          </button>
          <small>
            {activeLabel} queue - sorted by {sortLabels[sortMode].toLowerCase()}
          </small>
        </div>

        <div className="tab-strip" role="tablist" aria-label="Pull request filters">
          {tabs.map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === tab.id}
              className={activeView === tab.id ? "active" : ""}
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              data-testid={`inbox-tab-${tab.id}`}
            >
              <span>{tab.label}</span>
              <b>{inboxStats[tab.id]}</b>
            </button>
          ))}
        </div>
        <div className="inbox-toolbar-actions">
          <button
            className={`control-button tight ${focusOnly ? "active" : ""}`}
            onClick={() => setFocusOnly((current) => !current)}
            data-testid="inbox-focus-toggle"
            type="button"
          >
            <ListFilter size={14} />
            <span>{focusOnly ? "Focus on" : "Focus queue"}</span>
          </button>
          <button
            className="control-button tight"
            onClick={() => setSortMode(nextSort)}
            data-testid="inbox-sort-toggle"
            type="button"
            title={`Sort by ${sortLabels[nextSort]}`}
          >
            <ArrowUpDown size={14} />
            <span>{sortLabels[sortMode]}</span>
          </button>
          <div className="inbox-options-anchor">
            <button
              className={`icon-button small ${optionsOpen ? "active" : ""}`}
              title="Table options"
              aria-label="Table options"
              aria-expanded={optionsOpen}
              onClick={() => setOptionsOpen((open) => !open)}
              data-testid="inbox-view-options"
              type="button"
            >
              <SlidersHorizontal size={15} />
            </button>
            {optionsOpen && (
              <div className="inbox-view-menu" role="dialog" aria-label="Inbox view options" data-testid="inbox-view-menu">
                <div className="view-menu-head">
                  <span>View options</span>
                  <strong>{enabledColumnCount}/{inboxColumnConfigs.length}</strong>
                </div>

                <div className="view-menu-section">
                  <span>Density</span>
                  <div className="density-segment" role="group" aria-label="Inbox density">
                    {(["comfortable", "compact"] as const).map((mode) => (
                      <button
                        className={density === mode ? "active" : ""}
                        key={mode}
                        onClick={() => setDensity(mode)}
                        data-testid={`inbox-density-${mode}`}
                        type="button"
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="view-menu-section">
                  <span>Columns</span>
                  <div className="column-toggle-list">
                    {inboxColumnConfigs.map((column) => (
                      <label
                        className={`column-toggle ${visibleColumns[column.id] ? "checked" : ""}`}
                        data-testid={`inbox-column-${column.id}`}
                        key={column.id}
                      >
                        <input
                          checked={visibleColumns[column.id]}
                          onChange={() =>
                            setVisibleColumns((current) => ({
                              ...current,
                              [column.id]: !current[column.id],
                            }))
                          }
                          type="checkbox"
                        />
                        <span>
                          <strong>{column.label}</strong>
                          <small>{column.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  className="view-menu-reset"
                  data-testid="inbox-view-reset"
                  onClick={() => {
                    setDensity("comfortable");
                    setVisibleColumns(defaultInboxColumns);
                  }}
                  type="button"
                >
                  Reset view
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="inbox-workbench" aria-label="Inbox health summary">
        {summaryCards.map((card) => (
          <div className={`inbox-summary-card summary-${card.tone}`} key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <div className={`pr-table density-${density}`} role="table" aria-label="Pull requests" style={tableGridStyle}>
        <div className="pr-row pr-head" role="row">
          <span className="review-state-head">
            <CheckCircle2 size={17} />
          </span>
          <span className="title-column-head">
            <UserRound size={15} />
            <span>Title</span>
            <ArrowUpDown size={13} />
          </span>
          <span className={getColumnClass("stack")}>Stack</span>
          <span className={getColumnClass("changed")}>Changed</span>
          <span className={getColumnClass("risk")}>Risk</span>
          <span className={getColumnClass("ai")}>AI Review</span>
          <span className={getColumnClass("state")}>State</span>
          <span className={getColumnClass("ci")}>CI</span>
          <span className={getColumnClass("merge")}>Merge</span>
        </div>

        {visiblePullRequests.map((pr, index) => {
          const intel = getPrIntelligence(pr, index);
          const memory = reviewMemory[pr.id];
          const snoozed = Boolean(memory?.snoozedUntil && new Date(memory.snoozedUntil).getTime() > Date.now());

          return (
            <button
              key={pr.id}
              className={[
                "pr-row",
                selectedId === pr.id ? "selected" : "",
                memory?.pinned ? "pinned" : "",
                snoozed ? "snoozed" : "",
                memory ? `decision-${memory.decision}` : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelect(pr.id)}
              role="row"
            >
              <span className="pr-number">
                <span className={`review-marker marker-${pr.state}`} />
                <span className="pr-id">#{pr.number}</span>
              </span>
              <span className="pr-title">
                {pr.author.avatarUrl ? (
                  <img className="pr-author-avatar" src={pr.author.avatarUrl} alt={pr.author.login} />
                ) : (
                  <span className="pr-author-avatar">{pr.author.login[0]?.toUpperCase()}</span>
                )}
                <span className="pr-copy">
                  {pr.title}
                  <small>
                    {pr.author.login}/{pr.branch} · {formatRelativeTime(pr.updatedAt)}
                  </small>
                  {memory && (
                    <span className="pr-memory-meta">
                      {memory.pinned && <em>pinned</em>}
                      {snoozed && <em>snoozed</em>}
                      {memory.decision !== "watch" && <em>{memory.decision}</em>}
                      {memory.note && <em>note</em>}
                      {memory.chat.length > 0 && <em>{memory.chat.length} chat</em>}
                    </span>
                  )}
                </span>
              </span>
              <span className={getColumnClass("stack", "stack-cell")}>
                <span>{intel.stackName}</span>
                <em>{intel.stackIndex}/{intel.stackTotal}</em>
              </span>
              <span className={getColumnClass("changed", "change-cell")}>
                <b>+{intel.additions}</b>
                <i>-{intel.deletions}</i>
              </span>
              <span className={getColumnClass("risk")}>
                <span className={`risk-pill risk-${intel.risk}`}>{intel.risk}</span>
              </span>
              <span className={getColumnClass("ai", "ai-cell")}>
                {pr.codex.exists ? <CodexBadge reaction={pr.codex.reaction} compact /> : <span className="ai-dash">-</span>}
                {pr.codex.reaction === "changed" && (
                  <span className="reaction-shift" title="Codex reaction changed">
                    <Eye size={13} />
                    <ThumbsUp size={13} />
                  </span>
                )}
              </span>
              <span className={getColumnClass("state")}>
                <StatusPill state={pr.state} />
              </span>
              <span className={getColumnClass("ci", "review-cell")}>
                <AvatarStack people={pr.reviewers} />
                <CiBadge state={pr.ci} />
              </span>
              <span className={getColumnClass("merge", "merge-cell")}>
                <span
                  className="readiness-ring"
                  style={{ "--ready": `${Math.round((intel.readiness / intel.readinessTotal) * 100)}%` } as CSSProperties}
                >
                  <CheckCircle2 size={12} />
                </span>
                <em>{intel.readiness}/{intel.readinessTotal}</em>
              </span>
            </button>
          );
        })}

        {!visiblePullRequests.length && (
          <div className="inbox-empty" role="status">
            <CheckCircle2 size={18} />
            <strong>No pull requests in this view</strong>
            <span>
              {focusOnly
                ? "Your focus queue is clear. Turn focus off to see the full inbox."
                : "Switch tabs or adjust the sidebar filters to review another slice."}
            </span>
            {focusOnly && (
              <button type="button" onClick={() => setFocusOnly(false)}>
                Show full queue
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const sortLabels: Record<InboxSort, string> = {
  updated: "Updated",
  risk: "Risk",
  readiness: "Readiness",
};

function buildInboxGridTemplate(
  columns: Array<{ desktopTrack: string; narrowTrack?: string }>,
  mode: "desktop" | "narrow",
) {
  const leadColumns = mode === "desktop" ? "64px minmax(260px, 1.65fr)" : "58px minmax(140px, 1fr)";
  const tracks = columns.map((column) => (mode === "narrow" ? column.narrowTrack ?? column.desktopTrack : column.desktopTrack));
  return [leadColumns, ...tracks].join(" ");
}

function buildInboxStats(pullRequests: PullRequestSummary[]) {
  return pullRequests.reduce(
    (stats, pr, index) => {
      const intel = getPrIntelligence(pr, index);
      if (pr.state === "merged") stats.merged += 1;
      else if (pr.isDraft || pr.state === "draft") stats.draft += 1;
      else stats.open += 1;

      if (intel.readiness >= intel.readinessTotal - 1 && pr.ci === "success" && !pr.isDraft) stats.ready += 1;
      if (pr.ci === "failure" || pr.state === "changes_requested" || intel.risk === "high") stats.blocked += 1;
      if (!pr.codex.exists || pr.codex.reaction === "eyes") stats.aiPending += 1;
      return stats;
    },
    {
      open: 0,
      draft: 0,
      merged: 0,
      ready: 0,
      blocked: 0,
      aiPending: 0,
    },
  );
}

function filterPullRequests(
  pullRequests: PullRequestSummary[],
  activeView: InboxView,
  focusOnly: boolean,
  reviewMemory: ReviewMemoryByPr,
) {
  return pullRequests.filter((pr, index) => {
    const inView =
      activeView === "merged"
        ? pr.state === "merged"
        : activeView === "draft"
          ? pr.isDraft || pr.state === "draft"
          : pr.state !== "merged" && !pr.isDraft && pr.state !== "draft";

    return inView && (!focusOnly || isFocusPr(pr, index, reviewMemory));
  });
}

function sortPullRequests(pullRequests: PullRequestSummary[], sortMode: InboxSort) {
  const riskRank = { high: 3, medium: 2, low: 1 };
  return [...pullRequests].sort((a, b) => {
    if (sortMode === "updated") {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }

    const aIntel = getPrIntelligence(a);
    const bIntel = getPrIntelligence(b);

    if (sortMode === "risk") {
      return riskRank[bIntel.risk] - riskRank[aIntel.risk] || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }

    return (
      bIntel.readiness / bIntel.readinessTotal -
        aIntel.readiness / aIntel.readinessTotal ||
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  });
}

function isFocusPr(
  pr: PullRequestSummary,
  index: number,
  reviewMemory: ReviewMemoryByPr,
) {
  const memory = reviewMemory[pr.id];
  const snoozed = Boolean(memory?.snoozedUntil && new Date(memory.snoozedUntil).getTime() > Date.now());
  const intel = getPrIntelligence(pr, index);

  return (
    !snoozed &&
    (Boolean(memory?.pinned) ||
      memory?.decision === "blocked" ||
      pr.state === "changes_requested" ||
      pr.ci === "failure" ||
      !pr.codex.exists ||
      pr.codex.reaction === "eyes" ||
      intel.risk === "high")
  );
}
