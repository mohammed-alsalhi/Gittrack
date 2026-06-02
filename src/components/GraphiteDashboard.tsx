import {
  ArrowLeft,
  ArrowRight,
  Bell,
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
  GitPullRequest,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Tag,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import type {
  BranchSummary,
  BranchCleanupDecisionByRef,
  BranchCleanupStatus,
  CodexReaction,
  LocalGitSummary,
  PullRequestState,
  PullRequestSummary,
  RepoSummary,
  ReviewMemoryByPr,
  TestingBranchFlag,
  TestingBranchSuite,
} from "../types";
import { formatRelativeTime } from "./ui";

interface GraphiteDashboardProps {
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
}

type StackFilter = "all" | "active" | "merged";
type ReviewTab = "all" | "waiting" | "codex" | "requested";
type BranchFilter = "all" | "ready" | "ahead" | "behind";

export function GraphiteDashboard({
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
  onCreateTestingSuite,
  onUpdateTestingSuite,
  onDeleteTestingSuite,
  onCopyTestingSuite,
  onAddTestingFlag,
  onUpdateTestingFlag,
  onDeleteTestingFlag,
}: GraphiteDashboardProps) {
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
    document.getElementById(`graphite-${view}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectRelativeReview = (direction: 1 | -1) => {
    if (!reviewRows.length) return;

    const safeIndex = selectedReviewIndex >= 0 ? selectedReviewIndex : direction > 0 ? -1 : 0;
    const nextIndex = (safeIndex + direction + reviewRows.length) % reviewRows.length;
    onSelectPullRequest(reviewRows[nextIndex].id);
    setActiveView("reviews");
  };

  return (
    <div className="graphite-dashboard">
      <aside className="graphite-sidebar">
        <div className="graphite-brand">Gittrack</div>

        <label className="graphite-repo-select">
          <Github size={17} />
          <select value={activeRepo} onChange={(event) => onRepoChange(event.target.value)} aria-label="Repository">
            {repos.map((repo) => (
              <option value={repo.slug} key={repo.slug}>{repo.slug}</option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>

        <nav className="graphite-nav" aria-label="Gittrack">
          <GraphiteNavItem active={activeView === "stacks"} icon={<GitBranch size={17} />} label="Stacks" onClick={() => jumpTo("stacks")} />
          <GraphiteNavItem icon={<GitPullRequest size={17} />} label="Pull requests" count={pullRequests.length} onClick={() => jumpTo("reviews")} />
          <GraphiteNavItem active={activeView === "reviews"} icon={<Bot size={17} />} label="Reviews" count={reviewRows.length} onClick={() => jumpTo("reviews")} />
          <GraphiteNavItem active={activeView === "branches"} icon={<GitMerge size={17} />} label="Branches" onClick={() => jumpTo("branches")} />
          <GraphiteNavItem active={activeView === "local"} icon={<GitCommitHorizontal size={17} />} label="Local git" count={staleLocalCount + staleRemoteCount + dirtyWorktreeCount} onClick={() => jumpTo("local")} />
          <GraphiteDivider />
          <GraphiteNavItem icon={<GitCommitHorizontal size={17} />} label="Commits" onClick={() => jumpTo("branches")} />
          <GraphiteNavItem icon={<Tag size={17} />} label="Tags" onClick={() => jumpTo("branches")} />
          <GraphiteNavItem icon={<Search size={17} />} label="Search" onClick={onOpenCommandPalette} />
          <GraphiteNavItem icon={<Settings size={17} />} label="Settings" onClick={onOpenSettings} />
        </nav>

        <div className="graphite-sidebar-status">
          <span className="graphite-ready-dot" />
          <span>{source === "github" ? "Connected" : "Sample data"}</span>
          <button type="button" onClick={onOpenSettings} aria-label="Settings">
            <Settings size={16} />
          </button>
        </div>
      </aside>

      <section className="graphite-main-shell">
        <header className="graphite-topbar">
          <div className="graphite-topbar-nav">
            <button type="button" aria-label="Previous review" onClick={() => selectRelativeReview(-1)}>
              <ArrowLeft size={17} />
            </button>
            <button type="button" aria-label="Next review" onClick={() => selectRelativeReview(1)}>
              <ArrowRight size={17} />
            </button>
          </div>

          <label className="graphite-global-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search repos, branches, PRs..."
            />
            <button type="button" onClick={onOpenCommandPalette}>Cmd K</button>
          </label>

          <div className="graphite-topbar-actions">
            <button type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh">
              <span>{loading ? "..." : "/"}</span>
            </button>
            <button type="button" onClick={onOpenCommandPalette} aria-label="Create">
              <Plus size={17} />
            </button>
            <button type="button" aria-label="Notifications" onClick={() => jumpTo("reviews")}>
              <Bell size={17} />
              <i />
            </button>
            <span className="graphite-avatar">JD</span>
          </div>
        </header>

        <main className="graphite-workspace">
          <section className="graphite-stack-panel" id="graphite-stacks">
            <div className="graphite-section-head">
              <h1>Stacks</h1>
              <div className="graphite-segments" aria-label="Stack filter">
                <button type="button" className={stackFilter === "all" ? "active" : ""} onClick={() => setStackFilter("all")}>All stacks</button>
                <button type="button" className={stackFilter === "active" ? "active" : ""} onClick={() => setStackFilter("active")}>Active</button>
                <button type="button" className={stackFilter === "merged" ? "active" : ""} onClick={() => setStackFilter("merged")}>Merged</button>
              </div>
              <label className="graphite-checkbox">
                <input type="checkbox" checked={showBaseBranches} onChange={(event) => setShowBaseBranches(event.target.checked)} />
                <span>Show base branches</span>
              </label>
            </div>

            <div className="graphite-stack-axis">
              <span>Base</span>
              <span>Head</span>
            </div>

            <div className="graphite-stack-map">
              <div className="graphite-base-node">{defaultBranch}</div>
              <div className="graphite-rail" aria-hidden="true" />
              <div className="graphite-stack-list">
                {stackLanes.length ? stackLanes.map((lane, laneIndex) => (
                  <div className="graphite-lane" key={lane.key}>
                    {lane.rows.map((pr, index) => (
                      <button
                        type="button"
                        className={`graphite-stack-row ${pr.id === selectedPr?.id ? "selected" : ""}`}
                        key={pr.id}
                        style={{ marginLeft: `${index * 28}px` }}
                        onClick={() => onSelectPullRequest(pr.id)}
                      >
                        <GitBranch size={16} />
                        <span className="graphite-stack-copy">
                          <strong>{pr.branch}</strong>
                          <small>#{pr.number} {pr.title}</small>
                        </span>
                        <StatusDot state={pr.state} codex={pr.codex.reaction} />
                        <span className="graphite-status-text">{statusText(pr)}</span>
                        <span className="graphite-mini-avatar">{initials(pr.author.login)}</span>
                        <MoreHorizontal size={16} />
                      </button>
                    ))}
                    {laneIndex < stackLanes.length - 1 && <span className="graphite-lane-gap" />}
                  </div>
                )) : (
                  <div className="graphite-empty-state">
                    <strong>No stacks match this view.</strong>
                    <span>Change the search or stack filter to widen the lane.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="graphite-stack-legend">
              <span><i /> Direct dependency</span>
              <span><b /> Indirect dependency</span>
              <em>{stackPullRequests.length} stacks</em>
            </div>
          </section>

          <aside className="graphite-review-panel" id="graphite-reviews">
            <div className="graphite-review-head">
              <h2>Reviews</h2>
              <button type="button" onClick={() => setReviewTab("all")}>Inbox <ChevronDown size={14} /></button>
              <div className="graphite-review-tools">
                <button type="button" aria-label="Cycle review filter" onClick={() => setReviewTab(nextReviewTab(reviewTab))}><SlidersHorizontal size={16} /></button>
                <button type="button" aria-label="Settings" onClick={onOpenSettings}><Settings size={16} /></button>
              </div>
            </div>

            <div className="graphite-review-tabs">
              <button type="button" className={reviewTab === "all" ? "active" : ""} onClick={() => setReviewTab("all")}>All <span>{pullRequests.length}</span></button>
              <button type="button" className={reviewTab === "waiting" ? "active" : ""} onClick={() => setReviewTab("waiting")}>Waiting <span>{waitingCount}</span></button>
              <button type="button" className={reviewTab === "codex" ? "active" : ""} onClick={() => setReviewTab("codex")}>Codex review <span>{codexCount}</span></button>
              <button type="button" className={reviewTab === "requested" ? "active" : ""} onClick={() => setReviewTab("requested")}>Requested by me <span>{requestedCount}</span></button>
            </div>

            <div className="graphite-review-list">
              {reviewRows.length ? reviewRows.slice(0, 5).map((pr) => (
                <div
                  role="button"
                  tabIndex={0}
                  className={`graphite-review-row ${pr.id === selectedPr?.id ? "selected" : ""}`}
                  key={pr.id}
                  onClick={() => onSelectPullRequest(pr.id)}
                  onKeyDown={(event) => selectReviewWithKeyboard(event, pr.id, onSelectPullRequest)}
                >
                  <span className={`graphite-review-icon ${pr.codex.exists ? "codex" : ""}`}>
                    {pr.codex.exists ? <Bot size={15} /> : <GitBranch size={15} />}
                  </span>
                  <span className="graphite-review-copy">
                    <strong>#{pr.number} {pr.title}</strong>
                    <small>{`${pr.branch} -> ${pr.base}`}</small>
                    <em>{reviewRequester(pr)} requested review - {formatRelativeTime(pr.updatedAt)}</em>
                  </span>
                  <span className={`graphite-review-state ${statusTone(pr)}`}>
                    {statusText(pr)}
                  </span>
                  <button
                    type="button"
                    className={`graphite-codex-action ${pr.codex.reaction === "eyes" || !pr.codex.exists ? "watching" : "ready"}`}
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
                  <span className="graphite-mini-avatar">{initials(pr.reviewers[0]?.login ?? pr.author.login)}</span>
                </div>
              )) : (
                <div className="graphite-empty-state">
                  <strong>No reviews in this lane.</strong>
                  <span>Try All or clear the search.</span>
                </div>
              )}
            </div>

            <button className="graphite-view-all" type="button" onClick={onOpenCommandPalette}>
              View all reviews
              <kbd>Cmd Enter</kbd>
            </button>
          </aside>

          <section className="graphite-branches-panel" id="graphite-branches">
            <div className="graphite-branches-head">
              <h2>Branches</h2>
              <label>
                <Search size={15} />
                <input value={branchSearch} onChange={(event) => setBranchSearch(event.target.value)} placeholder="Filter branches..." />
              </label>
              <div>
                <button type="button" onClick={() => setBranchFilter(nextBranchFilter(branchFilter))}>{branchFilterLabel} <ChevronDown size={14} /></button>
                <button type="button" onClick={onOpenCommandPalette}>New branch</button>
              </div>
            </div>

            <div className="graphite-branch-table">
              <div className="graphite-branch-row graphite-branch-header">
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
                    className="graphite-branch-row"
                    key={branch.id}
                    onClick={() => pr && onSelectPullRequest(pr.id)}
                  >
                    <span className="graphite-branch-name"><GitBranch size={15} /> {branch.name}</span>
                    <span>{branch.behind === 0 ? <CheckCircle2 size={14} /> : "-"}</span>
                    <span>{branch.behind}</span>
                    <span>{branch.ahead}</span>
                    <span>{pr ? `#${pr.number}` : "-"}</span>
                    <span className={`graphite-review-state ${pr ? statusTone(pr) : "ready"}`}>{pr ? statusText(pr) : "Ready"}</span>
                    <span><code>{commitHash(branch.id)}</code> {pr?.title ?? "Update docs"}</span>
                    <span><MoreHorizontal size={16} /></span>
                  </button>
                );
              }) : (
                <div className="graphite-empty-state">
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

function GraphiteNavItem({
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

function GraphiteDivider() {
  return <hr aria-hidden="true" />;
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
    <section className="graphite-local-panel" id="graphite-local">
      <div className="graphite-local-head">
        <div>
          <h2>Local git</h2>
          <span>{summary ? `${summary.repoName} - ${summary.currentBranch}` : "Scan any local repo path"}</span>
        </div>
        <label className="graphite-local-path">
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

      {error && <div className="graphite-local-error">{error}</div>}

      <div className="graphite-local-bookmarks">
        <button type="button" onClick={onSaveBookmark} disabled={!path.trim() && !summary}>
          <Plus size={14} /> Save repo
        </button>
        {bookmarks.length ? bookmarks.map((bookmark) => (
          <span className="graphite-local-bookmark" key={bookmark}>
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
        <div className="graphite-local-grid">
          <div className="graphite-local-overview">
            <MetricTile label="Dirty files" value={summary.dirtyCount} detail={`${summary.stagedCount} staged / ${summary.unstagedCount} unstaged / ${summary.untrackedCount} new`} tone={summary.isDirty ? "amber" : "green"} />
            <MetricTile label="Local stale" value={staleLocalCount} detail={`${summary.staleThresholdDays}+ days or gone`} tone={staleLocalCount ? "amber" : "green"} />
            <MetricTile label="Remote stale" value={staleRemoteCount} detail={`${remoteBranches.length} remote refs`} tone={staleRemoteCount ? "amber" : "green"} />
            <MetricTile label="Worktrees" value={summary.worktrees.length} detail={`${dirtyWorktreeCount} dirty`} tone={dirtyWorktreeCount ? "amber" : "green"} />
          </div>

          <div className="graphite-local-card graphite-git-graph-card">
            <div className="graphite-local-card-head">
              <strong>Git graph</strong>
              <span>{formatRelativeTime(summary.generatedAt)}</span>
            </div>
            <pre className="graphite-git-graph">{summary.graphLines.slice(0, 32).join("\n") || "No commits found."}</pre>
          </div>

          <div className="graphite-local-card">
            <div className="graphite-local-card-head">
              <strong>Branches</strong>
              <span>{localBranches.length} local / {remoteBranches.length} remote</span>
            </div>
            <div className="graphite-local-branch-list">
              {localBranches.slice(0, 9).map((branch) => (
                <LocalBranchRow branch={branch} key={`${branch.kind}-${branch.name}`} />
              ))}
            </div>
          </div>

          <div className="graphite-local-card">
            <div className="graphite-local-card-head">
              <strong>Worktrees</strong>
              <span>{summary.worktrees.length ? "tracked locally" : "none"}</span>
            </div>
            <div className="graphite-worktree-list">
              {summary.worktrees.length ? summary.worktrees.map((worktree) => (
                <div className="graphite-worktree-row" key={worktree.path}>
                  <GitBranch size={14} />
                  <span>
                    <strong>{worktree.branch ?? "detached"}</strong>
                    <small>{worktree.path}</small>
                  </span>
                  <em className={worktree.clean ? "ready" : "waiting"}>{worktree.clean ? "clean" : `${worktree.dirtyCount} dirty`}</em>
                </div>
              )) : (
                <div className="graphite-empty-state">
                  <strong>No worktrees found.</strong>
                  <span>Create one with git worktree add and scan again.</span>
                </div>
              )}
            </div>
          </div>

          <div className="graphite-local-card">
            <div className="graphite-local-card-head">
              <strong>Stale refs</strong>
              <span>{staleBranches.length ? "cleanup candidates" : "clear"}</span>
            </div>
            <div className="graphite-stale-list">
              {staleBranches.length ? staleBranches.map((branch) => (
                <StaleBranchRow
                  branch={branch}
                  decision={branchCleanupDecisions[cleanupRefKey(summary.root, branch)]?.status ?? "review"}
                  onDecisionChange={(status) => onUpdateBranchCleanupDecision(cleanupRefKey(summary.root, branch), status)}
                  key={`${branch.kind}-${branch.name}`}
                />
              )) : (
                <div className="graphite-empty-state">
                  <strong>No stale refs.</strong>
                  <span>Nothing is older than the stale threshold.</span>
                </div>
              )}
            </div>
          </div>

          <div className="graphite-local-card graphite-suite-panel">
            <div className="graphite-local-card-head">
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
              <div className="graphite-empty-state">
                <strong>No testing suite yet.</strong>
                <span>Save branch sets and UI flags, then copy a repeatable run matrix.</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="graphite-empty-state graphite-local-empty">
          <strong>Local Git is ready to scan.</strong>
          <span>Enter a repo path or use the dev server default.</span>
        </div>
      )}
    </section>
  );
}

function MetricTile({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: "green" | "amber" }) {
  return (
    <div className={`graphite-local-metric ${tone}`}>
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
    <div className={`graphite-local-branch-row ${compact ? "compact" : ""}`}>
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
    <div className="graphite-stale-row">
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

  const toggleBranch = (branch: string) => {
    const nextBranches = selectedBranches.has(branch)
      ? suite.branches.filter((item) => item !== branch)
      : [...suite.branches, branch];
    onUpdateSuite(suite.id, { branches: nextBranches });
  };

  return (
    <div className="graphite-suite-card">
      <div className="graphite-suite-fields">
        <input value={suite.name} onChange={(event) => onUpdateSuite(suite.id, { name: event.target.value })} aria-label="Suite name" />
        <input value={suite.command} onChange={(event) => onUpdateSuite(suite.id, { command: event.target.value })} aria-label="Suite command" />
      </div>

      <div className="graphite-suite-branches">
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

      <div className="graphite-suite-flags">
        {suite.flags.map((flag) => (
          <div className="graphite-suite-flag" key={flag.id}>
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

      <div className="graphite-suite-actions">
        <button type="button" onClick={() => onAddFlag(suite.id)}><Plus size={14} /> Flag</button>
        <button type="button" onClick={() => onCopySuite(suite)}><Copy size={14} /> Copy matrix</button>
        <button type="button" onClick={() => onDeleteSuite(suite.id)}><Trash2 size={14} /> Delete</button>
      </div>
    </div>
  );
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

  return <span className={`graphite-status-dot ${tone}`} />;
}

function buildStackLanes(pullRequests: PullRequestSummary[]): StackLane[] {
  const groups = new Map<string, PullRequestSummary[]>();
  pullRequests.forEach((pr) => {
    const key = pr.stackName ?? pr.branch.split("/")[0] ?? "Stack";
    groups.set(key, [...(groups.get(key) ?? []), pr]);
  });

  return Array.from(groups.entries()).map(([key, rows]) => ({
    key,
    label: key,
    rows: rows.slice().sort((a, b) => (a.stackIndex ?? a.number) - (b.stackIndex ?? b.number)),
  }));
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
