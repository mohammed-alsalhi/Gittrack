import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  CheckCircle2,
  ClipboardList,
  Eye,
  GitMerge,
  GitPullRequest,
  History,
  Layers3,
  MessageSquareText,
  Pin,
  RadioTower,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Target,
  Terminal,
  Wifi,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { WorkMode } from "./ReviewOpsPanel";
import { PullRequestSummary } from "../types";
import { getPrIntelligence } from "../lib/insights";

interface CommandPaletteProps {
  open: boolean;
  pullRequests: PullRequestSummary[];
  onClose: () => void;
  onSelectPullRequest: (id: string) => void;
  onOpenSettings: () => void;
  onPromoteCodex: () => void;
  onPinSelected: () => void;
  onSnoozeSelected: () => void;
  onMarkReady: () => void;
  onSetQuery: (value: string) => void;
  onSmartMerge: () => void;
  onRunAutomationPlan: () => void;
  onOpenAttentionInbox: () => void;
  onOpenDecisionSimulator: () => void;
  onOpenActionJournal: () => void;
  onOpenDailyDigest: () => void;
  onOpenOutboundComms: () => void;
  onOpenBatchCommandCart: () => void;
  onOpenChangeRadar: () => void;
  onOpenStackTopology: () => void;
  onOpenStackReviewNavigator: () => void;
  onOpenReviewThreadResolver: () => void;
  onOpenAutopilotPlaybook: () => void;
  onOpenMergeQueueTimeline: () => void;
  onOpenTriageBoard: () => void;
  onOpenWorkspaceBrief: () => void;
  onOpenLaunchStudio: () => void;
  onOpenConnectionCenter: () => void;
  onOpenLocalGit: () => void;
  onModeChange: (mode: WorkMode) => void;
}

type PaletteCommand = {
  type: "command";
  id: string;
  label: string;
  detail: string;
  shortcut: string;
  keywords: string;
  tone: "blue" | "green" | "amber" | "red";
  icon: LucideIcon;
  action: () => void;
};

type PalettePr = {
  type: "pr";
  id: string;
  pr: PullRequestSummary;
};

type PaletteItem = PaletteCommand | PalettePr;

export function CommandPalette({
  open,
  pullRequests,
  onClose,
  onSelectPullRequest,
  onOpenSettings,
  onPromoteCodex,
  onPinSelected,
  onSnoozeSelected,
  onMarkReady,
  onSetQuery,
  onSmartMerge,
  onRunAutomationPlan,
  onOpenAttentionInbox,
  onOpenDecisionSimulator,
  onOpenActionJournal,
  onOpenDailyDigest,
  onOpenOutboundComms,
  onOpenBatchCommandCart,
  onOpenChangeRadar,
  onOpenStackTopology,
  onOpenStackReviewNavigator,
  onOpenReviewThreadResolver,
  onOpenAutopilotPlaybook,
  onOpenMergeQueueTimeline,
  onOpenTriageBoard,
  onOpenWorkspaceBrief,
  onOpenLaunchStudio,
  onOpenConnectionCenter,
  onOpenLocalGit,
  onModeChange,
}: CommandPaletteProps) {
  const [value, setValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const commands = useMemo<PaletteCommand[]>(
    () => [
      {
        type: "command",
        id: "smart-merge",
        label: "Queue smart merge for selected PR",
        detail: "Stages the selected pull request into the merge queue when its gates are ready.",
        shortcut: "⇧M",
        keywords: "merge queue ship land selected pr",
        tone: "green",
        icon: GitMerge,
        action: onSmartMerge,
      },
      {
        type: "command",
        id: "merge-train",
        label: "Open merge train cockpit",
        detail: "Inspect the persisted train, blocked gates, ready departures, and copy the ship plan.",
        shortcut: "M",
        keywords: "merge train cockpit queue timeline ship plan blocked ready staged",
        tone: "green",
        icon: GitMerge,
        action: onOpenMergeQueueTimeline,
      },
      {
        type: "command",
        id: "mark-ready",
        label: "Mark selected PR ready",
        detail: "Checks the ready decision so the PR appears in ship and queue planning views.",
        shortcut: "Y",
        keywords: "approve ready decision checklist",
        tone: "green",
        icon: CheckCircle2,
        action: onMarkReady,
      },
      {
        type: "command",
        id: "pin",
        label: "Pin selected PR to review queue",
        detail: "Keeps the selected PR in the focus lane until you explicitly clear it.",
        shortcut: "P",
        keywords: "pin focus priority queue",
        tone: "blue",
        icon: Pin,
        action: onPinSelected,
      },
      {
        type: "command",
        id: "snooze",
        label: "Snooze selected PR until tomorrow",
        detail: "Removes the PR from your immediate review queue for the next 24 hours.",
        shortcut: "Z",
        keywords: "snooze mute later tomorrow",
        tone: "amber",
        icon: BellOff,
        action: onSnoozeSelected,
      },
      {
        type: "command",
        id: "automation",
        label: "Run Autopilot plan",
        detail: "Runs the enabled automation rules across the selected repository's PRs.",
        shortcut: "A",
        keywords: "automation autopilot rules run",
        tone: "blue",
        icon: Sparkles,
        action: onRunAutomationPlan,
      },
      {
        type: "command",
        id: "autopilot-playbook",
        label: "Open autopilot playbook center",
        detail: "Run repeatable morning review, pre-merge, AI sweep, and release handoff routines.",
        shortcut: "P1",
        keywords: "autopilot playbook center routines morning review pre merge ai sweep release handoff",
        tone: "blue",
        icon: RadioTower,
        action: onOpenAutopilotPlaybook,
      },
      {
        type: "command",
        id: "change-radar",
        label: "Open change radar",
        detail: "Review what moved since your last checkpoint across Codex, CI, branches, and ship-ready work.",
        shortcut: "C1",
        keywords: "change radar delta unseen checkpoint codex ci branch drift ship ready since last check",
        tone: "blue",
        icon: Bell,
        action: onOpenChangeRadar,
      },
      {
        type: "command",
        id: "triage-board",
        label: "Open triage command board",
        detail: "Work blocker, review, AI, and ship lanes across every repo.",
        shortcut: "T",
        keywords: "triage board command lanes blocker review ai ship queue kanban",
        tone: "blue",
        icon: GitPullRequest,
        action: onOpenTriageBoard,
      },
      {
        type: "command",
        id: "batch-command-cart",
        label: "Open batch command cart",
        detail: "Select multiple PRs, preview impact, and run review, AI, unblock, or ship commands.",
        shortcut: "X",
        keywords: "batch command cart multi select bulk run pr review ai unblock ship",
        tone: "blue",
        icon: ClipboardList,
        action: onOpenBatchCommandCart,
      },
      {
        type: "command",
        id: "stack-topology",
        label: "Open stack topology map",
        detail: "Jump to the dependency map for stack lanes, blockers, drift, and AI gaps.",
        shortcut: "S1",
        keywords: "stack topology map dependency graph lanes blockers drift ai gaps",
        tone: "blue",
        icon: Layers3,
        action: onOpenStackTopology,
      },
      {
        type: "command",
        id: "local-git",
        label: "Open local Git scanner",
        detail: "Scan a local repository path for branches, worktrees, stale refs, and testing branch suites.",
        shortcut: "LG",
        keywords: "local git scanner worktree worktrees stale branches testing suites flags",
        tone: "blue",
        icon: Terminal,
        action: onOpenLocalGit,
      },
      {
        type: "command",
        id: "stack-review-navigator",
        label: "Open stack review navigator",
        detail: "Review stacked PRs bottom-up with CI, AI, blockers, and next-command guidance.",
        shortcut: "S",
        keywords: "stack navigator bottom up stacked pr review order ci ai blockers",
        tone: "blue",
        icon: Workflow,
        action: onOpenStackReviewNavigator,
      },
      {
        type: "command",
        id: "review-thread-resolver",
        label: "Open review thread resolver",
        detail: "Track unresolved human and Codex review threads, draft replies, and resolve decisions.",
        shortcut: "V",
        keywords: "review thread resolver comments replies unresolved codex changes requested",
        tone: "blue",
        icon: MessageSquareText,
        action: onOpenReviewThreadResolver,
      },
      {
        type: "command",
        id: "action-journal",
        label: "Open decision journal",
        detail: "Review the persistent audit trail and copy a handoff summary.",
        shortcut: "J",
        keywords: "journal history audit trail handoff actions memory",
        tone: "blue",
        icon: History,
        action: onOpenActionJournal,
      },
      {
        type: "command",
        id: "daily-digest",
        label: "Open daily digest composer",
        detail: "Draft Slack, standup, release, or executive updates from live workspace signals.",
        shortcut: "U",
        keywords: "daily digest composer slack standup update handoff executive release",
        tone: "blue",
        icon: MessageSquareText,
        action: onOpenDailyDigest,
      },
      {
        type: "command",
        id: "comms-outbox",
        label: "Open comms outbox",
        detail: "Track copied digests from drafted to queued, sent, and archived.",
        shortcut: "O",
        keywords: "comms outbox outbound send handoff copied digest queue sent archived",
        tone: "blue",
        icon: Send,
        action: onOpenOutboundComms,
      },
      {
        type: "command",
        id: "decision-simulator",
        label: "Open decision simulator",
        detail: "Model queue time, risk, AI coverage, and review load before acting.",
        shortcut: "D",
        keywords: "decision simulator scenario forecast risk queue ai review plan",
        tone: "blue",
        icon: Workflow,
        action: onOpenDecisionSimulator,
      },
      {
        type: "command",
        id: "attention-inbox",
        label: "Open attention inbox",
        detail: "Jump to the ranked cross-repo signals that need a decision.",
        shortcut: "N",
        keywords: "attention inbox notifications signals triage alerts review ai ship",
        tone: "blue",
        icon: Bell,
        action: onOpenAttentionInbox,
      },
      {
        type: "command",
        id: "workspace-brief",
        label: "Open workspace briefing",
        detail: "Jump to the ranked next actions, operating radar, and executive brief.",
        shortcut: "B",
        keywords: "brief briefing operating radar next actions dashboard",
        tone: "blue",
        icon: RadioTower,
        action: onOpenWorkspaceBrief,
      },
      {
        type: "command",
        id: "launch-studio",
        label: "Open PR launch studio",
        detail: "Jump to checkout, review, fix, and merge commands for the selected PR.",
        shortcut: "L",
        keywords: "launch commands terminal checkout review merge fix selected pr",
        tone: "blue",
        icon: Terminal,
        action: onOpenLaunchStudio,
      },
      {
        type: "command",
        id: "connection-center",
        label: "Connect GitHub repositories",
        detail: "Open settings for GitHub CLI login, tokens, repository scope, and live refresh.",
        shortcut: "G",
        keywords: "github connection token repos sync diagnostic settings",
        tone: "blue",
        icon: Wifi,
        action: onOpenConnectionCenter,
      },
      {
        type: "command",
        id: "focus-mode",
        label: "Start focus mode",
        detail: "Switches the review ops board to the highest-signal review sequence.",
        shortcut: "F",
        keywords: "focus mode review ops",
        tone: "blue",
        icon: Target,
        action: () => onModeChange("focus"),
      },
      {
        type: "command",
        id: "codex-promote",
        label: "Mark Codex eyes to thumbs up",
        detail: "Promotes the selected Codex review signal from seen to approved.",
        shortcut: "AI",
        keywords: "codex ai review eyes thumbs up",
        tone: "green",
        icon: Eye,
        action: onPromoteCodex,
      },
      {
        type: "command",
        id: "risky-work",
        label: "Inspect risky work",
        detail: "Filters the workspace toward high-risk review and CI items.",
        shortcut: "R",
        keywords: "risk high failing blocked inspect",
        tone: "red",
        icon: ShieldAlert,
        action: () => {
          onSetQuery("risk high");
          onClose();
        },
      },
      {
        type: "command",
        id: "settings",
        label: "Connect repositories",
        detail: "Open local GitHub settings to add repos or refresh real data.",
        shortcut: "⌘,",
        keywords: "settings github repositories token connect",
        tone: "blue",
        icon: Settings,
        action: onOpenSettings,
      },
    ],
    [
      onClose,
      onMarkReady,
      onModeChange,
      onOpenAutopilotPlaybook,
      onOpenAttentionInbox,
      onOpenActionJournal,
      onOpenBatchCommandCart,
      onOpenChangeRadar,
      onOpenStackReviewNavigator,
      onOpenStackTopology,
      onOpenReviewThreadResolver,
      onOpenDailyDigest,
      onOpenDecisionSimulator,
      onOpenOutboundComms,
      onOpenSettings,
      onOpenLaunchStudio,
      onOpenConnectionCenter,
      onOpenLocalGit,
      onOpenMergeQueueTimeline,
      onOpenTriageBoard,
      onOpenWorkspaceBrief,
      onPinSelected,
      onPromoteCodex,
      onRunAutomationPlan,
      onSetQuery,
      onSmartMerge,
      onSnoozeSelected,
    ],
  );
  const items = useMemo<PaletteItem[]>(() => {
    const query = value.trim().toLowerCase();
    const activeCommandIds = new Set([
      "smart-merge",
      "mark-ready",
      "pin",
      "snooze",
      "automation",
      "merge-train",
      "stack-topology",
      "local-git",
      "connection-center",
      "focus-mode",
      "codex-promote",
      "risky-work",
      "settings",
    ]);
    const commandMatches = commands
      .filter((command) => activeCommandIds.has(command.id))
      .filter((command) =>
        !query
          ? true
          : `${command.label} ${command.detail} ${command.keywords} ${command.shortcut}`.toLowerCase().includes(query),
      )
      .slice(0, query ? 10 : 16);
    const prMatches = pullRequests
      .filter((pr) =>
        !query
          ? true
          : `${pr.number} ${pr.title} ${pr.branch} ${pr.codex.statusText} ${pr.labels.join(" ")}`.toLowerCase().includes(query),
      )
      .slice(0, query ? 6 : 5)
      .map((pr) => ({ type: "pr" as const, id: pr.id, pr }));

    return [...commandMatches, ...prMatches];
  }, [commands, pullRequests, value]);
  const selectedItem = items[Math.min(activeIndex, Math.max(0, items.length - 1))];

  useEffect(() => {
    setActiveIndex(0);
  }, [value, open]);

  useEffect(() => {
    if (activeIndex <= items.length - 1) return;
    setActiveIndex(Math.max(0, items.length - 1));
  }, [activeIndex, items.length]);

  if (!open) return null;

  const runItem = (item = selectedItem) => {
    if (!item) {
      onSetQuery(value);
      onClose();
      return;
    }

    if (item.type === "command") {
      item.action();
      onClose();
      return;
    }

    onSelectPullRequest(item.pr.id);
    onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runItem();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (!items.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(items.length - 1, current + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      runItem();
    }
  };

  return (
    <div className="palette-backdrop">
      <form className="command-palette command-palette-pro" onSubmit={submit} onKeyDown={onKeyDown}>
        <div className="palette-input">
          <Search size={18} />
          <input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Search PRs or run a command..."
          />
          <button type="button" onClick={onClose} aria-label="Close command palette">
            <X size={16} />
          </button>
        </div>

        <div className="palette-pro-body">
          <div className="palette-results" role="listbox" aria-label="Commands and pull requests">
            <span>{value.trim() ? `${items.length} results` : "Command center"}</span>
            {items.map((item, index) => (
              <PaletteResult
                item={item}
                key={`${item.type}-${item.id}`}
                selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onRun={() => runItem(item)}
              />
            ))}
            {!items.length && (
              <div className="palette-empty">
                <Search size={16} />
                <strong>No matching commands or pull requests</strong>
                <small>Press Enter to search the inbox for "{value}".</small>
              </div>
            )}
          </div>

          <PalettePreview item={selectedItem} query={value} />
        </div>
      </form>
    </div>
  );
}

function PaletteResult({
  item,
  selected,
  onMouseEnter,
  onRun,
}: {
  item: PaletteItem;
  selected: boolean;
  onMouseEnter: () => void;
  onRun: () => void;
}) {
  if (item.type === "command") {
    const Icon = item.icon;
    return (
      <button
        type="button"
        className={`palette-result palette-${item.tone} ${selected ? "selected" : ""}`}
        onMouseEnter={onMouseEnter}
        onClick={onRun}
        role="option"
        aria-selected={selected}
      >
        <span className="palette-result-icon">
          <Icon size={16} />
        </span>
        <span className="palette-result-copy">
          <strong>{item.label}</strong>
          <small>{item.detail}</small>
        </span>
        <kbd>{item.shortcut}</kbd>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`palette-result palette-pr ${selected ? "selected" : ""}`}
      onMouseEnter={onMouseEnter}
      onClick={onRun}
      role="option"
      aria-selected={selected}
    >
      <span className="palette-result-icon">
        <GitPullRequest size={16} />
      </span>
      <span className="palette-result-copy">
        <strong>#{item.pr.number} {item.pr.title}</strong>
        <small>{item.pr.branch} - {item.pr.codex.statusText}</small>
      </span>
      {item.pr.codex.exists ? <Sparkles size={15} /> : <CheckCircle2 size={15} />}
    </button>
  );
}

function PalettePreview({ item, query }: { item?: PaletteItem; query: string }) {
  if (!item) {
    return (
      <aside className="palette-preview">
        <span>Search fallback</span>
        <h2>{query ? `Search "${query}"` : "No result selected"}</h2>
        <p>Press Enter to apply the typed query to the current PR inbox.</p>
      </aside>
    );
  }

  if (item.type === "command") {
    const Icon = item.icon;
    return (
      <aside className={`palette-preview preview-${item.tone}`}>
        <span>Command</span>
        <div className="preview-icon">
          <Icon size={18} />
        </div>
        <h2>{item.label}</h2>
        <p>{item.detail}</p>
        <div className="preview-meta">
          <strong>{item.shortcut}</strong>
          <em>Runs immediately</em>
        </div>
      </aside>
    );
  }

  const intel = getPrIntelligence(item.pr);

  return (
    <aside className="palette-preview preview-pr">
      <span>Pull request</span>
      <h2>#{item.pr.number} {item.pr.title}</h2>
      <p>{item.pr.branch} into {item.pr.base}</p>
      <div className="preview-grid">
        <div>
          <span>Risk</span>
          <strong className={`risk-text risk-${intel.risk}`}>{intel.risk}</strong>
        </div>
        <div>
          <span>Ready</span>
          <strong>{intel.readiness}/{intel.readinessTotal}</strong>
        </div>
        <div>
          <span>Queue</span>
          <strong>{intel.queueEstimate}</strong>
        </div>
      </div>
      <div className="preview-labels">
        {item.pr.labels.slice(0, 3).map((label) => (
          <em key={label}>{label}</em>
        ))}
        {!item.pr.labels.length && <em>unlabeled</em>}
      </div>
    </aside>
  );
}
