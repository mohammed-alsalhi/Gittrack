import { useMemo } from "react";
import {
  Bell,
  Bot,
  CheckCircle2,
  Clipboard,
  FileText,
  GitMerge,
  GitPullRequest,
  MessageSquareText,
  RadioTower,
  Rocket,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getPrIntelligence } from "../lib/insights";
import type {
  ActionJournalEntry,
  ActivityEvent,
  BranchSummary,
  DigestComposerAudience,
  DigestComposerMemory,
  DigestComposerMode,
  DigestCopyMeta,
  PullRequestSummary,
  RepoSummary,
  ReviewMemoryByPr,
} from "../types";
import { CiBadge, CodexBadge, formatRelativeTime, StatusPill } from "./ui";

interface DailyDigestComposerProps {
  repos: RepoSummary[];
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  activity: ActivityEvent[];
  reviewMemory: ReviewMemoryByPr;
  actionJournal: ActionJournalEntry[];
  memory: DigestComposerMemory;
  onMemoryChange: (patch: Partial<Omit<DigestComposerMemory, "updatedAt">>) => void;
  onCopyDigest: (text: string, lineCount: number, meta: DigestCopyMeta) => void;
  onOpenPullRequest: (repo: string, id: string) => void;
  onOpenTriageBoard: () => void;
  onOpenActionJournal: () => void;
  onPromoteCodex: (id: string) => void;
  onMarkReady: (id: string) => void;
}

interface DigestModeConfig {
  id: DigestComposerMode;
  label: string;
  detail: string;
  icon: LucideIcon;
}

interface DigestAudienceConfig {
  id: DigestComposerAudience;
  label: string;
  detail: string;
}

interface DigestModel {
  repoCount: number;
  activeCount: number;
  ready: PullRequestSummary[];
  blocked: PullRequestSummary[];
  aiGaps: PullRequestSummary[];
  reviewWait: PullRequestSummary[];
  staleBranches: BranchSummary[];
  recentJournal: ActionJournalEntry[];
  latestActivity?: ActivityEvent;
  confidence: number;
  headline: string;
}

const digestModes: DigestModeConfig[] = [
  {
    id: "slack",
    label: "Slack",
    detail: "Crisp channel update",
    icon: MessageSquareText,
  },
  {
    id: "standup",
    label: "Standup",
    detail: "What changed and next",
    icon: Users,
  },
  {
    id: "release",
    label: "Release",
    detail: "Ship-room readiness",
    icon: Rocket,
  },
  {
    id: "executive",
    label: "Executive",
    detail: "Portfolio-level signal",
    icon: RadioTower,
  },
];

const audienceOptions: DigestAudienceConfig[] = [
  { id: "team", label: "Team", detail: "operators and reviewers" },
  { id: "leadership", label: "Leadership", detail: "risk and delivery" },
  { id: "self", label: "Self", detail: "personal next actions" },
];

const includeOptions = [
  { key: "includeShip", label: "Ship", icon: GitMerge },
  { key: "includeBlockers", label: "Blockers", icon: ShieldAlert },
  { key: "includeAi", label: "AI", icon: Bot },
  { key: "includeJournal", label: "Journal", icon: FileText },
] as const;

export function DailyDigestComposer({
  repos,
  pullRequests,
  branches,
  activity,
  reviewMemory,
  actionJournal,
  memory,
  onMemoryChange,
  onCopyDigest,
  onOpenPullRequest,
  onOpenTriageBoard,
  onOpenActionJournal,
  onPromoteCodex,
  onMarkReady,
}: DailyDigestComposerProps) {
  const model = useMemo(
    () => buildDigestModel(repos, pullRequests, branches, activity, reviewMemory, actionJournal),
    [actionJournal, activity, branches, pullRequests, repos, reviewMemory],
  );
  const digest = useMemo(() => formatDigest(model, memory), [memory, model]);
  const sourceCount = digest.sources.length;
  const seenCommitmentIds = new Set<string>();
  const topCards = [
    ...model.blocked.slice(0, 2).map((pr) => ({ pr, lane: "blocked" as const })),
    ...model.ready.slice(0, 2).map((pr) => ({ pr, lane: "ready" as const })),
    ...model.aiGaps.slice(0, 3).map((pr) => ({ pr, lane: "ai" as const })),
  ]
    .filter(({ pr }) => {
      if (seenCommitmentIds.has(pr.id)) return false;
      seenCommitmentIds.add(pr.id);
      return true;
    })
    .slice(0, 5);
  const latestAction = model.recentJournal[0];

  return (
    <section className="daily-digest" id="daily-digest-composer" data-testid="daily-digest-composer">
      <div className="digest-head">
        <div>
          <span>Daily digest composer</span>
          <h2>{model.headline}</h2>
          <p>Turn triage, Codex coverage, release readiness, and your decision journal into a sendable update.</p>
        </div>
        <div className="digest-actions">
          <button type="button" onClick={onOpenTriageBoard}>
            <Target size={14} />
            Open triage
          </button>
          <button type="button" onClick={onOpenActionJournal}>
            <FileText size={14} />
            Open journal
          </button>
          <button
            type="button"
            onClick={() =>
              onCopyDigest(digest.text, digest.lines.length, {
                mode: memory.mode,
                audience: memory.audience,
                summary: model.headline,
                sources: digest.sources,
              })
            }
            data-testid="digest-copy-update"
          >
            <Clipboard size={14} />
            Copy update
          </button>
        </div>
      </div>

      <div className="digest-metrics" aria-label="Digest metrics">
        <DigestMetric label="Confidence" value={`${model.confidence}%`} detail={`${sourceCount} sources`} tone={model.confidence > 84 ? "green" : "amber"} icon={Sparkles} />
        <DigestMetric label="Ship-ready" value={model.ready.length} detail="clean candidates" tone={model.ready.length ? "green" : "blue"} icon={GitMerge} />
        <DigestMetric label="Blockers" value={model.blocked.length} detail="needs call" tone={model.blocked.length ? "red" : "green"} icon={ShieldAlert} />
        <DigestMetric label="AI gaps" value={model.aiGaps.length} detail="Codex lane" tone={model.aiGaps.length ? "purple" : "green"} icon={Bot} />
      </div>

      <div className="digest-control-bar">
        <div className="digest-mode-switch" role="tablist" aria-label="Digest mode">
          {digestModes.map((mode) => {
            const Icon = mode.icon;

            return (
              <button
                type="button"
                role="tab"
                aria-selected={memory.mode === mode.id}
                className={memory.mode === mode.id ? "active" : ""}
                key={mode.id}
                onClick={() => onMemoryChange({ mode: mode.id })}
                data-testid={`digest-mode-${mode.id}`}
              >
                <Icon size={14} />
                <span>
                  <strong>{mode.label}</strong>
                  <small>{mode.detail}</small>
                </span>
              </button>
            );
          })}
        </div>

        <div className="digest-audience-switch" aria-label="Audience">
          {audienceOptions.map((audience) => (
            <button
              type="button"
              aria-pressed={memory.audience === audience.id}
              className={memory.audience === audience.id ? "active" : ""}
              key={audience.id}
              onClick={() => onMemoryChange({ audience: audience.id })}
            >
              <strong>{audience.label}</strong>
              <small>{audience.detail}</small>
            </button>
          ))}
        </div>

        <div className="digest-include-switch" aria-label="Included sections">
          {includeOptions.map((option) => {
            const Icon = option.icon;
            const enabled = memory[option.key];

            return (
              <button
                type="button"
                aria-pressed={enabled}
                className={enabled ? "active" : ""}
                key={option.key}
                onClick={() => onMemoryChange({ [option.key]: !enabled })}
              >
                <Icon size={14} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="digest-body">
        <div className="digest-preview">
          <div className="digest-section-title">
            <Clipboard size={15} />
            <strong>Send-ready draft</strong>
            <span>{digest.lines.length} lines</span>
          </div>
          <pre>{digest.text}</pre>
          <div className="digest-source-strip">
            {digest.sources.map((source) => (
              <span key={source}>{source}</span>
            ))}
          </div>
        </div>

        <aside className="digest-rail">
          <div className="digest-section-title">
            <RadioTower size={15} />
            <strong>Evidence rail</strong>
          </div>
          <DigestEvidenceCard
            icon={ShieldAlert}
            label="Unblock"
            value={model.blocked[0] ? `#${model.blocked[0].number} ${model.blocked[0].title}` : "No blocker detected"}
            detail={model.blocked[0]?.ciSummary ?? "Blocked lane is clear"}
            tone={model.blocked.length ? "red" : "green"}
          />
          <DigestEvidenceCard
            icon={GitMerge}
            label="Ship next"
            value={model.ready[0] ? `#${model.ready[0].number} ${model.ready[0].title}` : "No merge-ready PR yet"}
            detail={model.ready[0]?.queueEstimate ?? "Waiting for a clean candidate"}
            tone={model.ready.length ? "green" : "blue"}
          />
          <DigestEvidenceCard
            icon={Bot}
            label="AI sweep"
            value={model.aiGaps.length ? `${model.aiGaps.length} PRs need Codex signal` : "Codex signals are clear"}
            detail={model.aiGaps[0]?.codex.statusText ?? "No AI follow-up needed"}
            tone={model.aiGaps.length ? "purple" : "green"}
          />
          <DigestEvidenceCard
            icon={Bell}
            label="Latest"
            value={latestAction?.message ?? model.latestActivity?.detail ?? "No fresh activity yet"}
            detail={latestAction ? formatRelativeTime(latestAction.createdAt) : model.latestActivity ? formatRelativeTime(model.latestActivity.at) : "Waiting for activity"}
            tone="blue"
          />
        </aside>
      </div>

      <div className="digest-commitments">
        <div className="digest-section-title">
          <GitPullRequest size={15} />
          <strong>Actionable commitments</strong>
          <span>{topCards.length}</span>
        </div>
        <div className="digest-commitment-list">
          {topCards.map(({ pr, lane }) => (
            <article className={`digest-commitment digest-${lane}`} key={`${lane}:${pr.id}`}>
              <button type="button" className="digest-commitment-main" onClick={() => onOpenPullRequest(pr.repo, pr.id)}>
                <span>
                  <strong>#{pr.number} {pr.title}</strong>
                  <small>{pr.repo} · updated {formatRelativeTime(pr.updatedAt)}</small>
                </span>
                <StatusPill state={pr.state} />
              </button>
              <div className="digest-commitment-signals">
                <CiBadge state={pr.ci} />
                <CodexBadge reaction={pr.codex.reaction} compact />
                <em>{lane}</em>
              </div>
              <div className="digest-commitment-actions">
                {lane === "ai" ? (
                  <button type="button" onClick={() => onPromoteCodex(pr.id)}>
                    <Bot size={14} />
                    Promote AI
                  </button>
                ) : lane === "ready" ? (
                  <button type="button" onClick={() => onMarkReady(pr.id)}>
                    <CheckCircle2 size={14} />
                    Mark ready
                  </button>
                ) : (
                  <button type="button" onClick={() => onOpenPullRequest(pr.repo, pr.id)}>
                    <ShieldAlert size={14} />
                    Inspect
                  </button>
                )}
              </div>
            </article>
          ))}
          {!topCards.length && (
            <div className="digest-empty">
              <CheckCircle2 size={17} />
              <strong>No urgent commitment to send.</strong>
              <span>The digest is calm, but you can still copy a status update for the record.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DigestMetric({
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
    <div className={`digest-metric metric-${tone}`}>
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function DigestEvidenceCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "amber" | "red" | "purple";
}) {
  return (
    <div className={`digest-evidence digest-${tone}`}>
      <span className="digest-evidence-icon">
        <Icon size={15} />
      </span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </span>
    </div>
  );
}

function buildDigestModel(
  repos: RepoSummary[],
  pullRequests: PullRequestSummary[],
  branches: BranchSummary[],
  activity: ActivityEvent[],
  reviewMemory: ReviewMemoryByPr,
  actionJournal: ActionJournalEntry[],
): DigestModel {
  const active = pullRequests.filter((pr) => pr.state !== "merged");
  const scored = active.map((pr, index) => ({
    pr,
    intel: getPrIntelligence(pr, index),
    memory: reviewMemory[pr.id],
  }));
  const blocked = scored
    .filter(({ pr, memory }) => memory?.decision === "blocked" || pr.ci === "failure" || pr.state === "changes_requested")
    .sort((a, b) => urgencyScore(b.pr, b.intel.risk) - urgencyScore(a.pr, a.intel.risk))
    .map(({ pr }) => pr);
  const ready = scored
    .filter(({ pr, intel, memory }) => {
      const snoozed = Boolean(memory?.snoozedUntil && new Date(memory.snoozedUntil).getTime() > Date.now());
      return (
        !pr.isDraft &&
        !snoozed &&
        pr.ci === "success" &&
        pr.state !== "changes_requested" &&
        memory?.decision !== "blocked" &&
        (memory?.decision === "ready" || pr.state === "approved" || intel.readiness >= intel.readinessTotal - 1)
      );
    })
    .sort((a, b) => b.intel.readiness - a.intel.readiness || new Date(b.pr.updatedAt).getTime() - new Date(a.pr.updatedAt).getTime())
    .map(({ pr }) => pr);
  const aiGaps = active
    .filter((pr) => !pr.codex.exists || pr.codex.reaction === "eyes")
    .sort((a, b) => Number(!b.codex.exists) - Number(!a.codex.exists) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const reviewWait = active.filter((pr) => pr.state === "waiting_review" || pr.reviewers.length === 0 || pr.isDraft);
  const staleBranches = branches.filter((branch) => branch.health === "diverged" || branch.health === "behind" || branch.health === "stale");
  const recentJournal = actionJournal.slice(0, 6);
  const latestActivity = [...activity].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
  const confidence = Math.max(
    62,
    Math.min(98, 82 + ready.length * 2 - blocked.length * 5 - aiGaps.length * 2 - staleBranches.length + Math.min(6, recentJournal.length * 2)),
  );
  const headline = blocked.length
    ? `${formatCount(blocked.length, "blocker")}, ${ready.length} ship-ready, ${formatCount(aiGaps.length, "AI gap")}`
    : ready.length
      ? `${ready.length} PRs are ready for a clean handoff`
      : `${formatCount(active.length, "active PR")} summarized across the portfolio`;

  return {
    repoCount: repos.length,
    activeCount: active.length,
    ready,
    blocked,
    aiGaps,
    reviewWait,
    staleBranches,
    recentJournal,
    latestActivity,
    confidence,
    headline,
  };
}

function formatDigest(model: DigestModel, memory: DigestComposerMemory) {
  const sources = [
    `${model.repoCount} repos`,
    formatCount(model.activeCount, "active PR"),
    `${model.ready.length} ready`,
    formatCount(model.blocked.length, "blocker"),
    formatCount(model.aiGaps.length, "AI gap"),
  ];
  if (memory.includeJournal) sources.push(`${model.recentJournal.length} journal moves`);

  const lead = leadLineForMode(memory.mode, model);
  const lines = [
    `GitTrack ${modeLabel(memory.mode)} update`,
    `Audience: ${audienceLabel(memory.audience)} · Confidence: ${model.confidence}% · Sources: ${sources.join(", ")}`,
    "",
    lead,
  ];

  if (memory.includeShip) {
    lines.push(
      model.ready[0]
        ? `Ship next: #${model.ready[0].number} ${model.ready[0].title} (${model.ready[0].ciSummary}; ${model.ready[0].queueEstimate ?? "queue ready"}).`
        : "Ship next: no clean merge candidate yet.",
    );
  }

  if (memory.includeBlockers) {
    lines.push(
      model.blocked[0]
        ? `Unblock: #${model.blocked[0].number} ${model.blocked[0].title} (${model.blocked[0].ciSummary}).`
        : "Unblock: blocker lane is clear.",
    );
  }

  if (memory.includeAi) {
    lines.push(
      model.aiGaps.length
        ? `AI sweep: ${model.aiGaps.length} PRs need Codex signal or a thumbs-up promotion; start with #${model.aiGaps[0].number}.`
        : "AI sweep: Codex signals are clear.",
    );
  }

  if (memory.includeJournal) {
    const journalLines = model.recentJournal.slice(0, 3).map((entry) => `[${entry.scope}] ${entry.message}`);
    lines.push(journalLines.length ? `Recent decisions: ${journalLines.join(" / ")}` : "Recent decisions: no local journal moves yet.");
  }

  lines.push(
    model.latestActivity ? `Latest signal: ${model.latestActivity.detail}` : "Latest signal: no external activity yet.",
  );

  if (memory.mode === "executive") {
    lines.push(`Ask: keep ${model.blocked.length ? "unblock work" : "release validation"} moving; review load is ${model.reviewWait.length} waiting PRs.`);
  }

  return {
    lines,
    sources,
    text: lines.join("\n"),
  };
}

function leadLineForMode(mode: DigestComposerMode, model: DigestModel) {
  if (mode === "release") {
    return `Release readiness: ${formatCount(model.ready.length, "clean candidate")}, ${formatCount(model.blocked.length, "blocker")}, ${formatCount(model.staleBranches.length, "stale branch risk")}.`;
  }
  if (mode === "executive") {
    return `Portfolio signal: ${model.repoCount} repos, ${formatCount(model.activeCount, "active PR")}, ${model.confidence}% confidence.`;
  }
  if (mode === "standup") {
    return `Standup: ${formatCount(model.ready.length, "PR")} can move forward, ${model.blocked.length} need an owner, ${model.aiGaps.length} need AI coverage.`;
  }
  return `Channel update: ${formatCount(model.activeCount, "active PR")}; ${model.ready.length} ready, ${model.blocked.length} blocked, ${formatCount(model.aiGaps.length, "AI gap")}.`;
}

function modeLabel(mode: DigestComposerMode) {
  return digestModes.find((item) => item.id === mode)?.label ?? "Slack";
}

function audienceLabel(audience: DigestComposerAudience) {
  return audienceOptions.find((item) => item.id === audience)?.label ?? "Team";
}

function urgencyScore(pr: PullRequestSummary, risk: "low" | "medium" | "high") {
  return (pr.ci === "failure" ? 20 : 0) + (pr.state === "changes_requested" ? 16 : 0) + (risk === "high" ? 10 : risk === "medium" ? 4 : 0);
}

function formatCount(count: number, label: string) {
  return `${count} ${count === 1 ? label : `${label}s`}`;
}
