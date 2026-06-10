import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Copy,
  Eye,
  GitBranch,
  GitCommitHorizontal,
  Github,
  GitMerge,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { getPullRequestActionState } from "../lib/prActions";
import type {
  BranchSummary,
  BranchCleanupDecisionByRef,
  BranchCleanupStatus,
  CodexReaction,
  LocalGitSummary,
  PullRequestState,
  PullRequestSummary,
  RepoSummary,
  ReviewMemory,
  ReviewMemoryByPr,
  TestingBranchFlag,
  TestingBranchSuite,
} from "../types";
import { formatRelativeTime } from "./ui";

interface GittrackDashboardProps {
  repos: RepoSummary[];
  activeRepo: string;
  source: "sample" | "github";
  query: string;
  loading: boolean;
  pullRequests: PullRequestSummary[];
  branches: BranchSummary[];
  selectedPrId?: string;
  reviewMemory: ReviewMemoryByPr;
  localGitPath: string;
  localGitBookmarks: string[];
  branchCleanupDecisions: BranchCleanupDecisionByRef;
  localGitSummary?: LocalGitSummary;
  localGitLoading: boolean;
  localGitError: string | null;
  testingBranchSuites: TestingBranchSuite[];
  onRepoChange: (repo: string) => void;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onLocalGitPathChange: (value: string) => void;
  onRefreshLocalGit: () => void;
  onSaveLocalGitBookmark: () => void;
  onSelectLocalGitBookmark: (bookmark: string) => void;
  onRemoveLocalGitBookmark: (bookmark: string) => void;
  onUpdateBranchCleanupDecision: (refKey: string, status: BranchCleanupStatus) => void;
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
  onSelectPullRequest: (id: string) => void;
  onPromoteCodex: (id: string) => void;
  onMarkReady: (id: string) => void;
  onSmartMerge: (id: string) => void;
  onCreateTestingSuite: () => void;
  onUpdateTestingSuite: (id: string, patch: Partial<TestingBranchSuite>) => void;
  onDeleteTestingSuite: (id: string) => void;
  onCopyTestingSuite: (suite: TestingBranchSuite) => void;
  onAddTestingFlag: (suiteId: string) => void;
  onUpdateTestingFlag: (suiteId: string, flagId: string, patch: Partial<TestingBranchFlag>) => void;
  onDeleteTestingFlag: (suiteId: string, flagId: string) => void;
}

interface StackLane {
  key: string;
  label: string;
  rows: PullRequestSummary[];
  isStacked: boolean;
}

type StackFilter = "all" | "active" | "merged";
type ReviewTab = "all" | "waiting" | "codex" | "requested";
type BranchFilter = "all" | "ready" | "ahead" | "behind";
type NextStepTone = "green" | "amber" | "red" | "blue";

interface NextStep {
  label: string;
  detail: string;
  tone: NextStepTone;
}

const DENSE_STACK_THRESHOLD = 12;
const MAX_STACK_INDENT = 5;

export function GittrackDashboard({
  repos,
  activeRepo,
  source,
  query,
  loading,
  pullRequests,
  branches,
  selectedPrId,
  reviewMemory,
  localGitPath,
  localGitBookmarks,
  branchCleanupDecisions,
  localGitSummary,
  localGitLoading,
  localGitError,
  testingBranchSuites,
  onRepoChange,
  onQueryChange,
  onRefresh,
  onLocalGitPathChange,
  onRefreshLocalGit,
  onSaveLocalGitBookmark,
  onSelectLocalGitBookmark,
  onRemoveLocalGitBookmark,
  onUpdateBranchCleanupDecision,
  onOpenSettings,
  onOpenCommandPalette,
  onSelectPullRequest,
  onPromoteCodex,
  onMarkReady,
  onSmartMerge,
  onCreateTestingSuite,
  onUpdateTestingSuite,
  onDeleteTestingSuite,
  onCopyTestingSuite,
  onAddTestingFlag,
  onUpdateTestingFlag,
  onDeleteTestingFlag,
}: GittrackDashboardProps) {
  const [activeView, setActiveView] = useState<"stacks" | "reviews" | "branches" | "local">("stacks");
  const [stackFilter, setStackFilter] = useState<StackFilter>("all");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("all");
  const [branchFilter, setBranchFilter] = useState<BranchFilter>("all");
  const [branchSearch, setBranchSearch] = useState("");
  const [showBaseBranches, setShowBaseBranches] = useState(false);
  const activeRepoSummary = repos.find((repo) => repo.slug === activeRepo) ?? repos[0];
  const defaultBranch = activeRepoSummary?.defaultBranch ?? "main";
  const searchedPullRequests = useMemo(
    () => pullRequests.filter((pr) => matchesPullRequestQuery(pr, query)),
    [pullRequests, query],
  );
  const stackPullRequests = useMemo(
    () => filterStackPullRequests(searchedPullRequests, stackFilter),
    [searchedPullRequests, stackFilter],
  );
  const stackLanes = useMemo(() => buildStackLanes(stackPullRequests), [stackPullRequests]);
  const denseStackMap = stackPullRequests.length > DENSE_STACK_THRESHOLD || stackLanes.length > 6;
  const visibleBranches = useMemo(
    () =>
      branches
        .filter((branch) => matchesBranchQuery(branch, branchSearch || query))
        .filter((branch) => matchesBranchFilter(branch, branchFilter))
        .filter((branch) => showBaseBranches || branch.name !== defaultBranch || branch.behind === 0)
        .slice()
        .sort((a, b) => (a.name === defaultBranch ? -1 : b.name === defaultBranch ? 1 : a.name.localeCompare(b.name))),
    [branchFilter, branchSearch, branches, defaultBranch, query, showBaseBranches],
  );
  const reviewRows = useMemo(
    () => filterReviews(sortReviews(searchedPullRequests, reviewMemory), reviewTab),
    [reviewMemory, reviewTab, searchedPullRequests],
  );
  const selectedPr = pullRequests.find((pr) => pr.id === selectedPrId) ?? reviewRows[0];
  const selectedBranch = selectedPr
    ? branches.find((branch) => branch.pullRequestNumber === selectedPr.number || branch.name === selectedPr.branch)
    : undefined;
  const selectedReviewMemory = selectedPr ? reviewMemory[selectedPr.id] : undefined;
  const waitingCount = pullRequests.filter((pr) => pr.state === "waiting_review").length;
  const codexCount = pullRequests.filter((pr) => pr.codex.exists).length;
  const requestedCount = pullRequests.filter((pr) => pr.author.login === "mohammed").length;
  const selectedReviewIndex = reviewRows.findIndex((pr) => pr.id === selectedPr?.id);
  const branchFilterLabel = branchFilter === "all" ? "All branches" : branchFilter === "ready" ? "Ready" : branchFilter === "ahead" ? "Ahead" : "Behind";
  const staleLocalCount = localGitSummary?.localBranches.filter((branch) => branch.stale).length ?? 0;
  const staleRemoteCount = localGitSummary?.remoteBranches.filter((branch) => branch.stale).length ?? 0;
  const dirtyWorktreeCount = localGitSummary?.worktrees.filter((worktree) => !worktree.clean).length ?? 0;
  const availableSuiteBranches = localGitSummary?.localBranches.map((branch) => branch.name) ?? [];

  const jumpTo = (view: "stacks" | "reviews" | "branches" | "local") => {
    setActiveView(view);
    document.getElementById(`gittrack-${view}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectRelativeReview = (direction: 1 | -1) => {
    if (!reviewRows.length) return;

    const safeIndex = selectedReviewIndex >= 0 ? selectedReviewIndex : direction > 0 ? -1 : 0;
    const nextIndex = (safeIndex + direction + reviewRows.length) % reviewRows.length;
    onSelectPullRequest(reviewRows[nextIndex].id);
    setActiveView("reviews");
  };

  return (
    <div className="gittrack-dashboard">
      <aside className="gittrack-sidebar">
        <div className="gittrack-brand">Gittrack</div>

        <label className="gittrack-repo-select">
          <Github size={17} />
          <select value={activeRepo} onChange={(event) => onRepoChange(event.target.value)} aria-label="Repository">
            {repos.map((repo) => (
              <option value={repo.slug} key={repo.slug}>{repo.slug}</option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>

        <nav className="gittrack-nav" aria-label="Gittrack">
          <GittrackNavItem active={activeView === "stacks"} icon={<GitBranch size={17} />} label="Stacks" onClick={() => jumpTo("stacks")} />
          <GittrackNavItem active={activeView === "reviews"} icon={<Bot size={17} />} label="Reviews" count={reviewRows.length} onClick={() => jumpTo("reviews")} />
          <GittrackNavItem active={activeView === "branches"} icon={<GitMerge size={17} />} label="Branches" onClick={() => jumpTo("branches")} />
          <GittrackNavItem active={activeView === "local"} icon={<GitCommitHorizontal size={17} />} label="Local git" count={staleLocalCount + staleRemoteCount + dirtyWorktreeCount} onClick={() => jumpTo("local")} />
          <GittrackNavItem icon={<Settings size={17} />} label="Settings" onClick={onOpenSettings} />
        </nav>

        <div className="gittrack-sidebar-status">
          <span className="gittrack-ready-dot" />
          <span>{source === "github" ? "Connected" : "Sample data"}</span>
          <button type="button" onClick={onOpenSettings} aria-label="Settings">
            <Settings size={16} />
          </button>
        </div>
      </aside>

      <section className="gittrack-main-shell">
        <header className="gittrack-topbar">
          <div className="gittrack-topbar-nav">
            <button type="button" aria-label="Previous review" onClick={() => selectRelativeReview(-1)}>
              <ArrowLeft size={17} />
            </button>
            <button type="button" aria-label="Next review" onClick={() => selectRelativeReview(1)}>
              <ArrowRight size={17} />
            </button>
          </div>

          <label className="gittrack-global-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search repos, branches, PRs..."
            />
            <button type="button" onClick={onOpenCommandPalette}>Cmd K</button>
          </label>

          <div className="gittrack-topbar-actions">
            <button type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh">
              <span>{loading ? "..." : "/"}</span>
            </button>
            <span className="gittrack-avatar">JD</span>
          </div>
        </header>

        <main className="gittrack-workspace">
          <section className="gittrack-stack-panel" id="gittrack-stacks">
            <div className="gittrack-section-head">
              <h1>Stacks</h1>
              <div className="gittrack-segments" aria-label="Stack filter">
                <button type="button" className={stackFilter === "all" ? "active" : ""} onClick={() => setStackFilter("all")}>All stacks</button>
                <button type="button" className={stackFilter === "active" ? "active" : ""} onClick={() => setStackFilter("active")}>Active</button>
                <button type="button" className={stackFilter === "merged" ? "active" : ""} onClick={() => setStackFilter("merged")}>Merged</button>
              </div>
              <label className="gittrack-checkbox">
                <input type="checkbox" checked={showBaseBranches} onChange={(event) => setShowBaseBranches(event.target.checked)} />
                <span>Show base branches</span>
              </label>
            </div>

            <div className="gittrack-stack-axis">
              <span>Base</span>
              <span>Head</span>
            </div>

            <div className={`gittrack-stack-map ${denseStackMap ? "dense" : ""}`}>
              <div className="gittrack-base-node">{defaultBranch}</div>
              <div className="gittrack-rail" aria-hidden="true" />
              <div className={`gittrack-stack-list ${denseStackMap ? "dense" : ""}`} tabIndex={0} aria-label={`${stackPullRequests.length} pull requests grouped into ${stackLanes.length} stack lanes`}>
                {stackLanes.length ? stackLanes.map((lane) => (
                  <div className={`gittrack-lane ${lane.isStacked ? "stacked" : "grouped"}`} key={lane.key}>
                    <div className="gittrack-lane-header">
                      <span>
                        <strong>{lane.label}</strong>
                        <small>{lane.isStacked ? "Stacked dependency lane" : "Branch family"}</small>
                      </span>
                      <em>{lane.rows.length}</em>
                    </div>
                    <div className="gittrack-lane-rows">
                      {lane.rows.map((pr, index) => {
                        const depth = stackDepthForPullRequest(pr, index, lane.isStacked);
                        return (
                          <button
                            type="button"
                            className={`gittrack-stack-row ${depth > 0 ? "deep" : ""} ${pr.id === selectedPr?.id ? "selected" : ""}`}
                            key={pr.id}
                            style={{ "--stack-offset": `${depth * 18}px` } as CSSProperties}
                            onClick={() => onSelectPullRequest(pr.id)}
                          >
                            <span className="gittrack-stack-glyph" aria-hidden="true">
                              <GitBranch size={15} />
                            </span>
                            <span className="gittrack-stack-copy">
                              <strong>{pr.branch}</strong>
                              <small>#{pr.number} {pr.title}</small>
                            </span>
                            <span className="gittrack-stack-depth">
                              {lane.isStacked ? `${Math.min(pr.stackIndex ?? index + 1, pr.stackTotal ?? lane.rows.length)}/${pr.stackTotal ?? lane.rows.length}` : pr.base}
                            </span>
                            <StatusDot state={pr.state} codex={pr.codex.reaction} />
                            <span className="gittrack-status-text">{statusText(pr)}</span>
                            <span className="gittrack-mini-avatar">{initials(pr.author.login)}</span>
                            <MoreHorizontal size={16} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )) : (
                  <div className="gittrack-empty-state">
                    <strong>No stacks match this view.</strong>
                    <span>Change the search or stack filter to widen the lane.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="gittrack-stack-legend">
              <span><i /> Branch lane</span>
              <span><b /> Stacked dependency</span>
              <em>{stackPullRequests.length} PRs / {stackLanes.length} lanes</em>
            </div>
          </section>

          <aside className="gittrack-review-panel" id="gittrack-reviews">
            <div className="gittrack-review-head">
              <h2>Reviews</h2>
            </div>

            <div className="gittrack-review-tabs">
              <button type="button" className={reviewTab === "all" ? "active" : ""} onClick={() => setReviewTab("all")}>All <span>{pullRequests.length}</span></button>
              <button type="button" className={reviewTab === "waiting" ? "active" : ""} onClick={() => setReviewTab("waiting")}>Waiting <span>{waitingCount}</span></button>
              <button type="button" className={reviewTab === "codex" ? "active" : ""} onClick={() => setReviewTab("codex")}>Codex review <span>{codexCount}</span></button>
              <button type="button" className={reviewTab === "requested" ? "active" : ""} onClick={() => setReviewTab("requested")}>Mine <span>{requestedCount}</span></button>
            </div>

            <SelectedNextStepsPanel
              pr={selectedPr}
              branch={selectedBranch}
              memory={selectedReviewMemory}
              onPromoteCodex={onPromoteCodex}
              onMarkReady={onMarkReady}
              onSmartMerge={onSmartMerge}
            />

            <div className="gittrack-review-list">
              {reviewRows.length ? reviewRows.slice(0, 5).map((pr) => (
                <div
                  role="button"
                  tabIndex={0}
                  className={`gittrack-review-row ${pr.id === selectedPr?.id ? "selected" : ""}`}
                  key={pr.id}
                  onClick={() => onSelectPullRequest(pr.id)}
                  onKeyDown={(event) => selectReviewWithKeyboard(event, pr.id, onSelectPullRequest)}
                >
                  <span className={`gittrack-review-icon ${pr.codex.exists ? "codex" : ""}`}>
                    {pr.codex.exists ? <Bot size={15} /> : <GitBranch size={15} />}
                  </span>
                  <span className="gittrack-review-copy">
                    <strong>#{pr.number} {pr.title}</strong>
                    <small>{`${pr.branch} -> ${pr.base}`}</small>
                    <em>{reviewRequester(pr)} requested review - {formatRelativeTime(pr.updatedAt)}</em>
                  </span>
                  <span className={`gittrack-review-state ${statusTone(pr)}`}>
                    {statusText(pr)}
                  </span>
                  <button
                    type="button"
                    className={`gittrack-codex-action ${pr.codex.reaction === "eyes" || !pr.codex.exists ? "watching" : "ready"}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (pr.codex.reaction !== "changed" && pr.codex.reaction !== "thumbs_up") onPromoteCodex(pr.id);
                    }}
                    disabled={pr.codex.reaction === "changed" || pr.codex.reaction === "thumbs_up"}
                    aria-label={pr.codex.reaction === "changed" || pr.codex.reaction === "thumbs_up" ? "Codex review is thumbs up" : "Mark Codex review thumbs up"}
                    title={pr.codex.statusText}
                  >
                    {pr.codex.reaction === "changed" || pr.codex.reaction === "thumbs_up" ? <ThumbsUp size={14} /> : <Eye size={14} />}
                  </button>
                  <span className="gittrack-mini-avatar">{initials(pr.reviewers[0]?.login ?? pr.author.login)}</span>
                </div>
              )) : (
                <div className="gittrack-empty-state">
                  <strong>No reviews in this lane.</strong>
                  <span>Try All or clear the search.</span>
                </div>
              )}
            </div>

          </aside>

          <section className="gittrack-branches-panel" id="gittrack-branches">
            <div className="gittrack-branches-head">
              <h2>Branches</h2>
              <label>
                <Search size={15} />
                <input value={branchSearch} onChange={(event) => setBranchSearch(event.target.value)} placeholder="Filter branches..." />
              </label>
              <div>
                <button type="button" onClick={() => setBranchFilter(nextBranchFilter(branchFilter))}>{branchFilterLabel} <ChevronDown size={14} /></button>
              </div>
            </div>

            <div className="gittrack-branch-table">
              <div className="gittrack-branch-row gittrack-branch-header">
                <span>Name</span>
                <span>Up to date</span>
                <span>Behind</span>
                <span>Ahead</span>
                <span>PR</span>
                <span>Status</span>
                <span>Last commit</span>
                <span />
              </div>
              {visibleBranches.length ? visibleBranches.map((branch) => {
                const pr = pullRequests.find((item) => item.number === branch.pullRequestNumber);
                return (
                  <button
                    type="button"
                    className="gittrack-branch-row"
                    key={branch.id}
                    onClick={() => pr && onSelectPullRequest(pr.id)}
                  >
                    <span className="gittrack-branch-name"><GitBranch size={15} /> {branch.name}</span>
                    <span>{branch.behind === 0 ? <CheckCircle2 size={14} /> : "-"}</span>
                    <span>{branch.behind}</span>
                    <span>{branch.ahead}</span>
                    <span>{pr ? `#${pr.number}` : "-"}</span>
                    <span className={`gittrack-review-state ${pr ? statusTone(pr) : "ready"}`}>{pr ? statusText(pr) : "Ready"}</span>
                    <span><code>{commitHash(branch.id)}</code> {pr?.title ?? "Update docs"}</span>
                    <span><MoreHorizontal size={16} /></span>
                  </button>
                );
              }) : (
                <div className="gittrack-empty-state">
                  <strong>No branches match.</strong>
                  <span>Clear the branch search or cycle the branch filter.</span>
                </div>
              )}
            </div>
          </section>

          <LocalGitPanel
            path={localGitPath}
            bookmarks={localGitBookmarks}
            branchCleanupDecisions={branchCleanupDecisions}
            summary={localGitSummary}
            loading={localGitLoading}
            error={localGitError}
            suites={testingBranchSuites}
            availableBranches={availableSuiteBranches}
            staleLocalCount={staleLocalCount}
            staleRemoteCount={staleRemoteCount}
            dirtyWorktreeCount={dirtyWorktreeCount}
            onPathChange={onLocalGitPathChange}
            onRefresh={onRefreshLocalGit}
            onSaveBookmark={onSaveLocalGitBookmark}
            onSelectBookmark={onSelectLocalGitBookmark}
            onRemoveBookmark={onRemoveLocalGitBookmark}
            onUpdateBranchCleanupDecision={onUpdateBranchCleanupDecision}
            onCreateSuite={onCreateTestingSuite}
            onUpdateSuite={onUpdateTestingSuite}
            onDeleteSuite={onDeleteTestingSuite}
            onCopySuite={onCopyTestingSuite}
            onAddFlag={onAddTestingFlag}
            onUpdateFlag={onUpdateTestingFlag}
            onDeleteFlag={onDeleteTestingFlag}
          />
        </main>
      </section>
    </div>
  );
}

function GittrackNavItem({
  active = false,
  icon,
  label,
  count,
  onClick,
}: {
  active?: boolean;
  icon: JSX.Element;
  label: string;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={active ? "active" : ""} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {typeof count === "number" && <em>{count}</em>}
    </button>
  );
}

function SelectedNextStepsPanel({
  pr,
  branch,
  memory,
  onPromoteCodex,
  onMarkReady,
  onSmartMerge,
}: {
  pr?: PullRequestSummary;
  branch?: BranchSummary;
  memory?: ReviewMemory;
  onPromoteCodex: (id: string) => void;
  onMarkReady: (id: string) => void;
  onSmartMerge: (id: string) => void;
}) {
  if (!pr) {
    return (
      <div className="gittrack-next-panel empty">
        <strong>Select a pull request</strong>
        <span>Pick a stack row, review row, or linked branch to see the next operational steps.</span>
      </div>
    );
  }

  const nextSteps = buildSelectedNextSteps(pr, branch, memory);
  const actionState = getPullRequestActionState(pr, branch, memory);

  return (
    <div className="gittrack-next-panel" aria-label="Selected pull request next steps">
      <div className="gittrack-next-head">
        <span>
          <small>Next steps</small>
          <strong>#{pr.number} {pr.title}</strong>
          <em>{pr.branch} -&gt; {pr.base}</em>
        </span>
        <span className={`gittrack-next-state ${statusTone(pr)}`}>{statusText(pr)}</span>
      </div>

      <div className="gittrack-next-steps">
        {nextSteps.map((step) => (
          <span className={`next-step ${step.tone}`} key={step.label}>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </span>
        ))}
      </div>

      <div className="gittrack-next-actions">
        <button type="button" onClick={() => onPromoteCodex(pr.id)} disabled={!actionState.canPromoteCodex}>
          <Eye size={14} />
          {actionState.codexReady ? "AI noted" : "Promote AI"}
        </button>
        <button type="button" onClick={() => onMarkReady(pr.id)} disabled={!actionState.canMarkReady}>
          <CheckCircle2 size={14} />
          {actionState.locallyReady ? "Marked ready" : "Mark ready"}
        </button>
        <button type="button" onClick={() => onSmartMerge(pr.id)} disabled={!actionState.canQueueMerge}>
          <GitMerge size={14} />
          Queue merge
        </button>
      </div>
    </div>
  );
}

function LocalGitPanel({
  path,
  bookmarks,
  branchCleanupDecisions,
  summary,
  loading,
  error,
  suites,
  availableBranches,
  staleLocalCount,
  staleRemoteCount,
  dirtyWorktreeCount,
  onPathChange,
  onRefresh,
  onSaveBookmark,
  onSelectBookmark,
  onRemoveBookmark,
  onUpdateBranchCleanupDecision,
  onCreateSuite,
  onUpdateSuite,
  onDeleteSuite,
  onCopySuite,
  onAddFlag,
  onUpdateFlag,
  onDeleteFlag,
}: {
  path: string;
  bookmarks: string[];
  branchCleanupDecisions: BranchCleanupDecisionByRef;
  summary?: LocalGitSummary;
  loading: boolean;
  error: string | null;
  suites: TestingBranchSuite[];
  availableBranches: string[];
  staleLocalCount: number;
  staleRemoteCount: number;
  dirtyWorktreeCount: number;
  onPathChange: (value: string) => void;
  onRefresh: () => void;
  onSaveBookmark: () => void;
  onSelectBookmark: (bookmark: string) => void;
  onRemoveBookmark: (bookmark: string) => void;
  onUpdateBranchCleanupDecision: (refKey: string, status: BranchCleanupStatus) => void;
  onCreateSuite: () => void;
  onUpdateSuite: (id: string, patch: Partial<TestingBranchSuite>) => void;
  onDeleteSuite: (id: string) => void;
  onCopySuite: (suite: TestingBranchSuite) => void;
  onAddFlag: (suiteId: string) => void;
  onUpdateFlag: (suiteId: string, flagId: string, patch: Partial<TestingBranchFlag>) => void;
  onDeleteFlag: (suiteId: string, flagId: string) => void;
}) {
  const localBranches = summary?.localBranches ?? [];
  const remoteBranches = summary?.remoteBranches ?? [];
  const staleBranches = [...localBranches, ...remoteBranches].filter((branch) => branch.stale).slice(0, 8);

  return (
    <section className="gittrack-local-panel" id="gittrack-local">
      <div className="gittrack-local-head">
        <div>
          <h2>Local git</h2>
          <span>{summary ? `${summary.repoName} - ${summary.currentBranch}` : "Scan any local repo path"}</span>
        </div>
        <label className="gittrack-local-path">
          <Github size={15} />
          <input
            value={path}
            onChange={(event) => onPathChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onRefresh();
            }}
            placeholder="~/code/my-repo"
          />
        </label>
        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? "Scanning..." : "Scan repo"}
        </button>
      </div>

      {error && <div className="gittrack-local-error">{error}</div>}

      <div className="gittrack-local-bookmarks">
        <button type="button" onClick={onSaveBookmark} disabled={!path.trim() && !summary}>
          <Plus size={14} /> Save repo
        </button>
        {bookmarks.length ? bookmarks.map((bookmark) => (
          <span className="gittrack-local-bookmark" key={bookmark}>
            <button type="button" onClick={() => onSelectBookmark(bookmark)} title={bookmark}>
              {repoPathLabel(bookmark)}
            </button>
            <button type="button" onClick={() => onRemoveBookmark(bookmark)} aria-label={`Remove ${bookmark}`}>
              <Trash2 size={12} />
            </button>
          </span>
        )) : (
          <em>No saved local repos yet.</em>
        )}
      </div>

      {summary ? (
        <div className="gittrack-local-grid">
          <div className="gittrack-local-overview">
            <MetricTile label="Dirty files" value={summary.dirtyCount} detail={`${summary.stagedCount} staged / ${summary.unstagedCount} unstaged / ${summary.untrackedCount} new`} tone={summary.isDirty ? "amber" : "green"} />
            <MetricTile label="Local stale" value={staleLocalCount} detail={`${summary.staleThresholdDays}+ days or gone`} tone={staleLocalCount ? "amber" : "green"} />
            <MetricTile label="Remote stale" value={staleRemoteCount} detail={`${remoteBranches.length} remote refs`} tone={staleRemoteCount ? "amber" : "green"} />
            <MetricTile label="Worktrees" value={summary.worktrees.length} detail={`${dirtyWorktreeCount} dirty`} tone={dirtyWorktreeCount ? "amber" : "green"} />
          </div>

          <div className="gittrack-local-card gittrack-git-graph-card">
            <div className="gittrack-local-card-head">
              <strong>Git graph</strong>
              <span>{formatRelativeTime(summary.generatedAt)}</span>
            </div>
            <pre className="gittrack-git-graph">{summary.graphLines.slice(0, 32).join("\n") || "No commits found."}</pre>
          </div>

          <div className="gittrack-local-card">
            <div className="gittrack-local-card-head">
              <strong>Branches</strong>
              <span>{localBranches.length} local / {remoteBranches.length} remote</span>
            </div>
            <div className="gittrack-local-branch-list">
              {localBranches.slice(0, 9).map((branch) => (
                <LocalBranchRow branch={branch} key={`${branch.kind}-${branch.name}`} />
              ))}
            </div>
          </div>

          <div className="gittrack-local-card">
            <div className="gittrack-local-card-head">
              <strong>Worktrees</strong>
              <span>{summary.worktrees.length ? "tracked locally" : "none"}</span>
            </div>
            <div className="gittrack-worktree-list">
              {summary.worktrees.length ? summary.worktrees.map((worktree) => (
                <div className="gittrack-worktree-row" key={worktree.path}>
                  <GitBranch size={14} />
                  <span>
                    <strong>{worktree.branch ?? "detached"}</strong>
                    <small>{worktree.path}</small>
                  </span>
                  <em className={worktree.clean ? "ready" : "waiting"}>{worktree.clean ? "clean" : `${worktree.dirtyCount} dirty`}</em>
                </div>
              )) : (
                <div className="gittrack-empty-state">
                  <strong>No worktrees found.</strong>
                  <span>Create one with git worktree add and scan again.</span>
                </div>
              )}
            </div>
          </div>

          <div className="gittrack-local-card">
            <div className="gittrack-local-card-head">
              <strong>Stale refs</strong>
              <span>{staleBranches.length ? "cleanup candidates" : "clear"}</span>
            </div>
            <div className="gittrack-stale-list">
              {staleBranches.length ? staleBranches.map((branch) => (
                <StaleBranchRow
                  branch={branch}
                  decision={branchCleanupDecisions[cleanupRefKey(summary.root, branch)]?.status ?? "review"}
                  onDecisionChange={(status) => onUpdateBranchCleanupDecision(cleanupRefKey(summary.root, branch), status)}
                  key={`${branch.kind}-${branch.name}`}
                />
              )) : (
                <div className="gittrack-empty-state">
                  <strong>No stale refs.</strong>
                  <span>Nothing is older than the stale threshold.</span>
                </div>
              )}
            </div>
          </div>

          <div className="gittrack-local-card gittrack-suite-panel">
            <div className="gittrack-local-card-head">
              <strong>Testing branch suites</strong>
              <button type="button" onClick={onCreateSuite}><Plus size={14} /> New suite</button>
            </div>
            {suites.length ? suites.map((suite) => (
              <TestingSuiteCard
                suite={suite}
                availableBranches={availableBranches}
                onUpdateSuite={onUpdateSuite}
                onDeleteSuite={onDeleteSuite}
                onCopySuite={onCopySuite}
                onAddFlag={onAddFlag}
                onUpdateFlag={onUpdateFlag}
                onDeleteFlag={onDeleteFlag}
                key={suite.id}
              />
            )) : (
              <div className="gittrack-empty-state">
                <strong>No testing suite yet.</strong>
                <span>Save branch sets and UI flags, then copy a repeatable run matrix.</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="gittrack-empty-state gittrack-local-empty">
          <strong>Local Git is ready to scan.</strong>
          <span>Enter a repo path or use the dev server default.</span>
        </div>
      )}
    </section>
  );
}

function MetricTile({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: "green" | "amber" }) {
  return (
    <div className={`gittrack-local-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function repoPathLabel(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function LocalBranchRow({ branch, compact = false }: { branch: LocalGitSummary["localBranches"][number]; compact?: boolean }) {
  const tone = branch.gone || branch.stale ? "stale" : branch.behind ? "behind" : branch.ahead ? "ahead" : "ready";
  return (
    <div className={`gittrack-local-branch-row ${compact ? "compact" : ""}`}>
      <CircleDot size={13} />
      <span>
        <strong>{branch.name}</strong>
        {!compact && <small>{branch.subject}</small>}
      </span>
      <em className={tone}>{branch.gone ? "gone" : branch.stale ? `${branch.ageDays}d stale` : branch.ahead ? `+${branch.ahead}` : branch.behind ? `-${branch.behind}` : "fresh"}</em>
    </div>
  );
}

function StaleBranchRow({
  branch,
  decision,
  onDecisionChange,
}: {
  branch: LocalGitSummary["localBranches"][number];
  decision: BranchCleanupStatus;
  onDecisionChange: (status: BranchCleanupStatus) => void;
}) {
  return (
    <div className="gittrack-stale-row">
      <CircleDot size={13} />
      <span>
        <strong>{branch.name}</strong>
        <small>{branch.kind} - {branch.gone ? "upstream gone" : `${branch.ageDays} days old`}</small>
      </span>
      <em className={decision}>{decision}</em>
      <div>
        <button type="button" className={decision === "review" ? "active" : ""} onClick={() => onDecisionChange("review")}>Review</button>
        <button type="button" className={decision === "keep" ? "active" : ""} onClick={() => onDecisionChange("keep")}>Keep</button>
        <button type="button" className={decision === "delete" ? "active" : ""} onClick={() => onDecisionChange("delete")}>Delete</button>
      </div>
    </div>
  );
}

function cleanupRefKey(root: string, branch: LocalGitSummary["localBranches"][number]) {
  return `${root}:${branch.kind}:${branch.name}`;
}

function TestingSuiteCard({
  suite,
  availableBranches,
  onUpdateSuite,
  onDeleteSuite,
  onCopySuite,
  onAddFlag,
  onUpdateFlag,
  onDeleteFlag,
}: {
  suite: TestingBranchSuite;
  availableBranches: string[];
  onUpdateSuite: (id: string, patch: Partial<TestingBranchSuite>) => void;
  onDeleteSuite: (id: string) => void;
  onCopySuite: (suite: TestingBranchSuite) => void;
  onAddFlag: (suiteId: string) => void;
  onUpdateFlag: (suiteId: string, flagId: string, patch: Partial<TestingBranchFlag>) => void;
  onDeleteFlag: (suiteId: string, flagId: string) => void;
}) {
  const selectedBranches = new Set(suite.branches);
  const preview = buildTestingSuitePreview(suite);

  const toggleBranch = (branch: string) => {
    const nextBranches = selectedBranches.has(branch)
      ? suite.branches.filter((item) => item !== branch)
      : [...suite.branches, branch];
    onUpdateSuite(suite.id, { branches: nextBranches });
  };

  return (
    <div className="gittrack-suite-card">
      <div className="gittrack-suite-fields">
        <input value={suite.name} onChange={(event) => onUpdateSuite(suite.id, { name: event.target.value })} aria-label="Suite name" />
        <input value={suite.command} onChange={(event) => onUpdateSuite(suite.id, { command: event.target.value })} aria-label="Suite command" />
      </div>

      <div className="gittrack-suite-branches">
        {(availableBranches.length ? availableBranches : suite.branches).map((branch) => (
          <button
            type="button"
            className={selectedBranches.has(branch) ? "active" : ""}
            onClick={() => toggleBranch(branch)}
            key={branch}
          >
            {branch}
          </button>
        ))}
      </div>

      <div className="gittrack-suite-flags">
        {suite.flags.map((flag) => (
          <div className="gittrack-suite-flag" key={flag.id}>
            <input
              type="checkbox"
              checked={flag.enabled}
              onChange={(event) => onUpdateFlag(suite.id, flag.id, { enabled: event.target.checked })}
              aria-label={`Enable ${flag.key}`}
            />
            <input value={flag.key} onChange={(event) => onUpdateFlag(suite.id, flag.id, { key: event.target.value })} aria-label="Flag key" />
            <input value={flag.value} onChange={(event) => onUpdateFlag(suite.id, flag.id, { value: event.target.value })} aria-label="Flag value" />
            <button type="button" onClick={() => onDeleteFlag(suite.id, flag.id)} aria-label="Delete flag"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>

      <textarea value={suite.notes} onChange={(event) => onUpdateSuite(suite.id, { notes: event.target.value })} aria-label="Suite notes" />

      <div className="gittrack-suite-preview-head">
        <span>Command preview</span>
        <em>{Math.max(1, suite.branches.length)} {suite.branches.length === 1 ? "run" : "runs"}</em>
      </div>
      <pre className="gittrack-suite-preview">{preview}</pre>

      <div className="gittrack-suite-actions">
        <button type="button" onClick={() => onAddFlag(suite.id)}><Plus size={14} /> Flag</button>
        <button type="button" onClick={() => onCopySuite(suite)}><Copy size={14} /> Copy matrix</button>
        <button type="button" onClick={() => onDeleteSuite(suite.id)}><Trash2 size={14} /> Delete</button>
      </div>
    </div>
  );
}

function buildTestingSuitePreview(suite: TestingBranchSuite) {
  const branches = suite.branches.length ? suite.branches : ["$BRANCH"];
  const envPrefix = suite.flags
    .filter((flag) => flag.enabled && flag.key.trim())
    .map((flag) => `${flag.key.trim()}=${quoteSuiteValue(flag.value)}`)
    .join(" ");
  const command = suite.command.trim() || "npm run test:ui -- --branch=$BRANCH";

  return branches
    .map((branch) => {
      const resolvedEnv = envPrefix.split("$BRANCH").join(branch);
      const resolvedCommand = command.split("$BRANCH").join(branch);
      return [resolvedEnv, resolvedCommand].filter(Boolean).join(" ");
    })
    .join("\n");
}

function quoteSuiteValue(value: string) {
  if (!value) return "''";
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) return value;
  return `'${value.split("'").join("'\"'\"'")}'`;
}

function StatusDot({ state, codex }: { state: PullRequestState; codex: CodexReaction }) {
  const tone =
    state === "approved" || codex === "thumbs_up" || codex === "changed"
      ? "ready"
      : state === "changes_requested"
        ? "blocked"
        : codex === "eyes"
          ? "codex"
          : "waiting";

  return <span className={`gittrack-status-dot ${tone}`} />;
}

function buildStackLanes(pullRequests: PullRequestSummary[]): StackLane[] {
  const groups = new Map<string, PullRequestSummary[]>();
  pullRequests.forEach((pr) => {
    const key = pr.stackName ? `stack:${pr.stackName}` : `family:${branchFamily(pr.branch)}`;
    groups.set(key, [...(groups.get(key) ?? []), pr]);
  });

  return Array.from(groups.entries())
    .map(([key, rows]) => {
      const isStacked = rows.some((pr) => typeof pr.stackName === "string" || typeof pr.stackIndex === "number");
      return {
        key,
        label: key.replace(/^(stack|family):/, ""),
        isStacked,
        rows: rows.slice().sort((a, b) => {
          if (isStacked) return (a.stackIndex ?? a.number) - (b.stackIndex ?? b.number);
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }),
      };
    })
    .sort((a, b) => {
      if (a.isStacked !== b.isStacked) return a.isStacked ? -1 : 1;
      return b.rows.length - a.rows.length || a.label.localeCompare(b.label);
    });
}

function branchFamily(branch: string) {
  const [first, second] = branch.split("/");
  if (!first) return "Unstacked";
  if (!second) return first;
  if (/^(feat|feature|fix|chore|docs|test|tests|refactor|cursor|codex)$/i.test(first)) return first;
  return first;
}

function stackDepthForPullRequest(pr: PullRequestSummary, index: number, isStacked: boolean) {
  if (!isStacked) return 0;
  return Math.max(0, Math.min(MAX_STACK_INDENT, (pr.stackIndex ?? index + 1) - 1));
}

function sortReviews(pullRequests: PullRequestSummary[], reviewMemory: ReviewMemoryByPr) {
  return pullRequests.slice().sort((a, b) => scoreReview(b, reviewMemory) - scoreReview(a, reviewMemory));
}

function filterStackPullRequests(pullRequests: PullRequestSummary[], filter: StackFilter) {
  if (filter === "merged") return pullRequests.filter((pr) => pr.state === "merged");
  if (filter === "active") return pullRequests.filter((pr) => pr.state !== "merged" && pr.state !== "draft");
  return pullRequests;
}

function filterReviews(pullRequests: PullRequestSummary[], tab: ReviewTab) {
  if (tab === "waiting") return pullRequests.filter((pr) => pr.state === "waiting_review");
  if (tab === "codex") return pullRequests.filter((pr) => pr.codex.exists);
  if (tab === "requested") return pullRequests.filter((pr) => pr.author.login === "mohammed");
  return pullRequests;
}

function matchesPullRequestQuery(pr: PullRequestSummary, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [
    pr.repo,
    pr.title,
    pr.branch,
    pr.base,
    String(pr.number),
    pr.state,
    pr.codex.statusText,
    pr.author.login,
    ...pr.labels,
  ].some((value) => value.toLowerCase().includes(needle));
}

function matchesBranchQuery(branch: BranchSummary, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [branch.repo, branch.name, branch.health, String(branch.pullRequestNumber ?? "")].some((value) =>
    value.toLowerCase().includes(needle),
  );
}

function matchesBranchFilter(branch: BranchSummary, filter: BranchFilter) {
  if (filter === "ready") return branch.behind === 0;
  if (filter === "ahead") return branch.ahead > 0;
  if (filter === "behind") return branch.behind > 0;
  return true;
}

function nextBranchFilter(filter: BranchFilter): BranchFilter {
  if (filter === "all") return "ready";
  if (filter === "ready") return "ahead";
  if (filter === "ahead") return "behind";
  return "all";
}

function nextReviewTab(tab: ReviewTab): ReviewTab {
  if (tab === "all") return "waiting";
  if (tab === "waiting") return "codex";
  if (tab === "codex") return "requested";
  return "all";
}

function selectReviewWithKeyboard(
  event: KeyboardEvent<HTMLDivElement>,
  id: string,
  onSelectPullRequest: (id: string) => void,
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onSelectPullRequest(id);
}

function scoreReview(pr: PullRequestSummary, reviewMemory: ReviewMemoryByPr) {
  const memory = reviewMemory[pr.id];
  return (
    (pr.ci === "failure" ? 80 : 0) +
    (pr.state === "changes_requested" ? 70 : 0) +
    (pr.codex.reaction === "eyes" || pr.codex.reaction === "none" ? 25 : 0) +
    (memory?.pinned ? 20 : 0) +
    (pr.state === "waiting_review" ? 16 : 0) +
    (pr.state === "approved" ? 8 : 0)
  );
}

function buildSelectedNextSteps(pr: PullRequestSummary, branch?: BranchSummary, memory?: ReviewMemory): NextStep[] {
  const steps: NextStep[] = [];
  const actionState = getPullRequestActionState(pr, branch, memory);
  const branchNeedsSync = branch && (branch.health === "diverged" || branch.behind > 0);

  if (pr.ci === "failure") {
    steps.push({ label: "Fix checks", detail: pr.ciSummary, tone: "red" });
  } else if (pr.ci === "pending") {
    steps.push({ label: "Wait for CI", detail: pr.ciSummary, tone: "amber" });
  } else if (pr.ci === "success") {
    steps.push({ label: "Checks clear", detail: pr.ciSummary, tone: "green" });
  } else {
    steps.push({ label: "Checks unknown", detail: pr.ciSummary, tone: "blue" });
  }

  if (branchNeedsSync) {
    steps.push({
      label: branch.health === "diverged" ? "Rebase branch" : "Sync branch",
      detail: `${branch.ahead} ahead / ${branch.behind} behind ${pr.base}`,
      tone: branch.health === "diverged" ? "red" : "amber",
    });
  } else if (actionState.branchKnown) {
    steps.push({
      label: "Branch clean",
      detail: branch ? `${branch.ahead} ahead / ${branch.behind} behind ${pr.base}` : "No branch drift found",
      tone: "green",
    });
  } else {
    steps.push({ label: "Branch unknown", detail: "Refresh branch data before queueing.", tone: "amber" });
  }

  if (branchNeedsSync) {
    steps.push({
      label: "Ready after sync",
      detail: branch.health === "diverged" ? "Rebase before marking ready." : "Pull base before marking ready.",
      tone: branch.health === "diverged" ? "red" : "amber",
    });
  } else if (pr.state === "changes_requested") {
    steps.push({ label: "Address review", detail: "Changes requested before this can ship.", tone: "red" });
  } else if (pr.codex.reaction === "none" && !memory?.checklist.checked_codex) {
    steps.push({ label: "Get AI signal", detail: "Promote Codex before marking ready.", tone: "amber" });
  } else if (pr.codex.reaction === "eyes" && !memory?.checklist.checked_codex) {
    steps.push({ label: "Promote AI", detail: pr.codex.statusText, tone: "amber" });
  } else if (memory?.decision === "ready") {
    steps.push({ label: "Ready locally", detail: "Your review checklist is complete.", tone: "green" });
  } else if (pr.state === "approved" || pr.codex.reaction === "changed" || pr.codex.reaction === "thumbs_up") {
    steps.push({ label: "Mark ready", detail: "Record the local decision, then queue merge.", tone: "green" });
  } else {
    steps.push({ label: "Review pending", detail: "Wait for reviewer approval or more signal.", tone: "blue" });
  }

  return steps.slice(0, 3);
}

function statusText(pr: Pick<PullRequestSummary, "state" | "codex">) {
  if (pr.codex.reaction === "changed") return "Codex review";
  if (pr.state === "approved") return "Ready";
  if (pr.state === "waiting_review") return "Waiting";
  if (pr.state === "changes_requested") return "Changes";
  if (pr.state === "draft") return "Draft";
  return "Open";
}

function statusTone(pr: Pick<PullRequestSummary, "state" | "codex">) {
  if (pr.state === "approved" || pr.codex.reaction === "thumbs_up" || pr.codex.reaction === "changed") return "ready";
  if (pr.state === "changes_requested") return "blocked";
  if (pr.codex.reaction === "eyes") return "codex";
  return "waiting";
}

function reviewRequester(pr: PullRequestSummary) {
  return pr.reviewers.find((person) => !person.isCodex)?.login ?? pr.author.login;
}

function initials(value: string) {
  return value
    .split(/[-_\s]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "GH";
}

function commitHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).slice(0, 7).padEnd(7, "0");
}
