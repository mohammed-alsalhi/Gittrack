export type CheckState = "success" | "failure" | "pending" | "unknown";

export type PullRequestState =
  | "draft"
  | "waiting_review"
  | "changes_requested"
  | "approved"
  | "merged"
  | "open";

export type BranchHealth = "healthy" | "ahead" | "behind" | "diverged" | "stale";

export type CodexReaction = "none" | "eyes" | "thumbs_up" | "changed";

export interface RepoSummary {
  slug: string;
  name: string;
  owner: string;
  defaultBranch: string;
  openPrs: number;
  url?: string;
}

export interface BranchSummary {
  id: string;
  repo: string;
  name: string;
  health: BranchHealth;
  ahead: number;
  behind: number;
  updatedAt: string;
  pullRequestNumber?: number;
}

export interface ReviewPerson {
  login: string;
  avatarUrl?: string;
  role?: string;
  isCodex?: boolean;
}

export interface ReviewEvent {
  id: string;
  reviewer: ReviewPerson;
  state: "approved" | "changes_requested" | "commented" | "dismissed" | "pending";
  body?: string;
  reaction: CodexReaction;
  submittedAt: string;
  sourceUrl?: string;
}

export interface CodexSignal {
  exists: boolean;
  reaction: CodexReaction;
  statusText: string;
  lastSeenAt?: string;
  events: ReviewEvent[];
}

export interface PullRequestSummary {
  id: string;
  repo: string;
  number: number;
  title: string;
  branch: string;
  base: string;
  state: PullRequestState;
  isDraft: boolean;
  author: ReviewPerson;
  reviewers: ReviewPerson[];
  reviewEvents: ReviewEvent[];
  codex: CodexSignal;
  ci: CheckState;
  ciSummary: string;
  labels: string[];
  milestone?: string;
  stackName?: string;
  stackIndex?: number;
  stackTotal?: number;
  additions?: number;
  deletions?: number;
  risk?: "low" | "medium" | "high";
  readiness?: number;
  readinessTotal?: number;
  queueEstimate?: string;
  files?: string[];
  createdAt: string;
  updatedAt: string;
  url?: string;
}

export type ReviewDecision = "watch" | "ready" | "blocked";

export type ReviewChecklistKey =
  | "read_diff"
  | "validated_ci"
  | "checked_codex"
  | "ready_to_merge";

export interface ReviewMemory {
  decision: ReviewDecision;
  note: string;
  checklist: Record<ReviewChecklistKey, boolean>;
  chat: ReviewChatMessage[];
  pinned: boolean;
  snoozedUntil?: string;
  updatedAt: string;
}

export type ReviewChatRole = "user" | "assistant";

export interface ReviewChatMessage {
  id: string;
  role: ReviewChatRole;
  body: string;
  createdAt: string;
}

export type ReviewMemoryPatch = Partial<Omit<ReviewMemory, "checklist" | "updatedAt">> & {
  checklist?: Partial<Record<ReviewChecklistKey, boolean>>;
};

export type ReviewMemoryByPr = Record<string, ReviewMemory>;

export type ShipRoomBriefMode = "standup" | "slack" | "release";

export interface ShipRoomBriefSnapshot {
  id: string;
  repo: string;
  mode: ShipRoomBriefMode;
  title: string;
  body: string[];
  metrics: {
    open: number;
    ready: number;
    blocked: number;
    codexPending: number;
  };
  createdAt: string;
}

export type ReviewNudgeStatus = "open" | "copied" | "done" | "muted";

export interface ReviewNudgeMemory {
  status: ReviewNudgeStatus;
  updatedAt: string;
}

export type ReviewNudgeMemoryById = Record<string, ReviewNudgeMemory>;

export type StackPlanStepKind = "rebase" | "resolve" | "test" | "review" | "merge";

export interface StackPlanStep {
  id: string;
  kind: StackPlanStepKind;
  title: string;
  detail: string;
  targetId?: string;
  targetLabel?: string;
  done: boolean;
}

export interface StackPlanSnapshot {
  id: string;
  repo: string;
  title: string;
  createdAt: string;
  steps: StackPlanStep[];
}

export type StackPlanByRepo = Record<string, StackPlanSnapshot>;

export interface MergeImpactMemory {
  selectedPrIds: string[];
  updatedAt: string;
}

export type MergeImpactMemoryByRepo = Record<string, MergeImpactMemory>;

export interface MergeQueueMemory {
  queuedPrIds: string[];
  queuedAtByPr: Record<string, string>;
  blockedByPr: Record<string, string>;
  updatedAt: string;
}

export type CodexSignalMemoryStatus = "open" | "acknowledged" | "muted";

export interface CodexSignalMemory {
  status: CodexSignalMemoryStatus;
  updatedAt: string;
}

export type CodexSignalMemoryByPr = Record<string, CodexSignalMemory>;

export interface ReleaseForecastSnapshot {
  id: string;
  repo: string;
  committedAt: string;
  etaMinutes: number;
  confidence: number;
  readyPrIds: string[];
  blockerPrIds: string[];
  headline: string;
}

export type ReleaseForecastByRepo = Record<string, ReleaseForecastSnapshot>;

export type ReviewerRouteStatus = "open" | "drafted" | "rerouted" | "done" | "muted";

export interface ReviewerRouteMemory {
  status: ReviewerRouteStatus;
  targetReviewer?: string;
  updatedAt: string;
}

export type ReviewerRouteMemoryByPr = Record<string, ReviewerRouteMemory>;

export interface ReviewRunSnapshot {
  id: string;
  repo: string;
  startedAt: string;
  activeStepId?: string;
  completedStepIds: string[];
}

export type ReviewRunByRepo = Record<string, ReviewRunSnapshot>;

export type WorkspaceBriefActionStatus = "open" | "queued" | "done";

export interface WorkspaceBriefActionMemory {
  status: WorkspaceBriefActionStatus;
  updatedAt: string;
}

export type WorkspaceBriefActionMemoryById = Record<string, WorkspaceBriefActionMemory>;

export type LaunchCommandStatus = "open" | "copied" | "done";

export interface LaunchCommandMemory {
  status: LaunchCommandStatus;
  updatedAt: string;
}

export type LaunchCommandMemoryById = Record<string, LaunchCommandMemory>;

export type ConnectionCheckStatus = "open" | "verified" | "muted";

export interface ConnectionCheckMemory {
  status: ConnectionCheckStatus;
  updatedAt: string;
}

export type ConnectionCheckMemoryById = Record<string, ConnectionCheckMemory>;

export type AttentionItemStatus = "open" | "acknowledged" | "done" | "muted";

export interface AttentionItemMemory {
  status: AttentionItemStatus;
  updatedAt: string;
}

export type AttentionItemMemoryById = Record<string, AttentionItemMemory>;

export type DecisionScenarioMode = "ship" | "unblock" | "ai" | "review";

export interface DecisionScenarioMemory {
  mode: DecisionScenarioMode;
  selectedPrIds?: string[];
  updatedAt: string;
}

export type BatchExecutionMode = "ship" | "review" | "ai" | "unblock";

export interface BatchExecutionMemory {
  mode: BatchExecutionMode;
  selectedPrIds: string[];
  updatedAt: string;
}

export type StackReviewMode = "bottom_up" | "risk_first" | "ship_ready";

export interface StackReviewNavigatorMemory {
  selectedStackKey?: string;
  mode: StackReviewMode;
  includeMerged: boolean;
  updatedAt: string;
}

export type ReviewThreadStatus = "open" | "drafted" | "resolved" | "muted";

export interface ReviewThreadMemory {
  status: ReviewThreadStatus;
  updatedAt: string;
}

export type ReviewThreadMemoryById = Record<string, ReviewThreadMemory>;

export type AutopilotPlaybookId = "morning_review" | "pre_merge" | "ai_sweep" | "release_handoff";

export interface AutopilotPlaybookMemory {
  activePlaybookId: AutopilotPlaybookId;
  completedStepIds: string[];
  lastRunAt?: string;
  updatedAt: string;
}

export type ChangeRadarMode = "unseen" | "codex" | "risk" | "ship";

export interface ChangeRadarMemory {
  mode: ChangeRadarMode;
  acknowledgedSignalIds: string[];
  trackedPrIds: string[];
  lastCheckpointAt?: string;
  updatedAt: string;
}

export type DigestComposerMode = "standup" | "slack" | "release" | "executive";

export type DigestComposerAudience = "self" | "team" | "leadership";

export interface DigestComposerMemory {
  mode: DigestComposerMode;
  audience: DigestComposerAudience;
  includeAi: boolean;
  includeBlockers: boolean;
  includeShip: boolean;
  includeJournal: boolean;
  updatedAt: string;
}

export interface DigestCopyMeta {
  mode: DigestComposerMode;
  audience: DigestComposerAudience;
  summary: string;
  sources: string[];
}

export type OutboundUpdateKind = "daily_digest" | "journal" | "ship_room" | "triage";

export type OutboundUpdateStatus = "drafted" | "queued" | "sent" | "archived";

export interface OutboundUpdate {
  id: string;
  kind: OutboundUpdateKind;
  status: OutboundUpdateStatus;
  title: string;
  summary: string;
  body: string;
  channel: DigestComposerMode;
  audience: DigestComposerAudience;
  sourceCount: number;
  lineCount: number;
  relatedPrIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type ActionJournalScope =
  | "decision"
  | "attention"
  | "review"
  | "ship"
  | "ai"
  | "ops"
  | "connection"
  | "system";

export type ActionJournalTone = "blue" | "green" | "amber" | "red" | "purple";

export interface ActionJournalEntry {
  id: string;
  message: string;
  scope: ActionJournalScope;
  tone: ActionJournalTone;
  repo?: string;
  prNumber?: number;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  repo: string;
  title: string;
  detail: string;
  state: PullRequestState | BranchHealth | CheckState;
  at: string;
}

export interface TrackerDataset {
  repos: RepoSummary[];
  branches: BranchSummary[];
  pullRequests: PullRequestSummary[];
  activity: ActivityEvent[];
}

export interface TrackerConfig {
  token: string;
  repoSlugs: string[];
}

export interface LocalGitRemote {
  name: string;
  fetchUrl?: string;
  pushUrl?: string;
}

export interface LocalGitBranch {
  name: string;
  kind: "local" | "remote";
  sha: string;
  updatedAt: string;
  ageDays: number;
  author: string;
  subject: string;
  upstream?: string;
  remote?: string;
  ahead: number;
  behind: number;
  gone: boolean;
  current: boolean;
  stale: boolean;
  worktreePath?: string;
}

export interface LocalGitWorktree {
  path: string;
  branch?: string;
  head?: string;
  detached: boolean;
  bare: boolean;
  clean: boolean;
  dirtyCount: number;
  stale: boolean;
}

export interface LocalGitSummary {
  repoPath: string;
  root: string;
  repoName: string;
  currentBranch: string;
  defaultBranch: string;
  generatedAt: string;
  statusLine: string;
  isDirty: boolean;
  dirtyCount: number;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  staleThresholdDays: number;
  remotes: LocalGitRemote[];
  localBranches: LocalGitBranch[];
  remoteBranches: LocalGitBranch[];
  worktrees: LocalGitWorktree[];
  graphLines: string[];
}

export interface TestingBranchFlag {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface TestingBranchSuite {
  id: string;
  repoPath: string;
  name: string;
  branches: string[];
  command: string;
  flags: TestingBranchFlag[];
  notes: string;
  updatedAt: string;
}

export type BranchCleanupStatus = "review" | "keep" | "delete";

export interface BranchCleanupDecision {
  status: BranchCleanupStatus;
  updatedAt: string;
}

export type BranchCleanupDecisionByRef = Record<string, BranchCleanupDecision>;
