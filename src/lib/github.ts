import {
  BranchHealth,
  BranchSummary,
  CheckState,
  CodexReaction,
  CodexSignal,
  PullRequestState,
  PullRequestSummary,
  RepoSummary,
  ReviewEvent,
  ReviewPerson,
  TrackerConfig,
  TrackerDataset,
} from "../types";

type GitHubRepo = {
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch: string;
  html_url: string;
};

type GitHubBranch = {
  name: string;
  commit: { sha: string; url: string };
};

type GitHubPull = {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  draft?: boolean;
  html_url: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  head: { ref: string; sha: string; user?: { login: string } | null };
  base: { ref: string };
  user: { login: string; avatar_url?: string };
  labels: Array<{ name: string }>;
  milestone?: { title: string } | null;
};

type GitHubReview = {
  id: number;
  user: { login: string; avatar_url?: string } | null;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  body?: string;
  submitted_at?: string;
  html_url?: string;
};

type GitHubComment = {
  id: number;
  user: { login: string; avatar_url?: string } | null;
  body?: string;
  created_at: string;
  updated_at: string;
  html_url?: string;
  reactions?: {
    "+1"?: number;
    eyes?: number;
  };
};

type GitHubStatus = {
  state: "success" | "failure" | "pending" | "error";
  total_count: number;
  statuses: Array<{ state: string }>;
};

type GitHubCheckRuns = {
  total_count: number;
  check_runs: Array<{
    status: "queued" | "in_progress" | "completed" | string;
    conclusion:
      | "success"
      | "failure"
      | "neutral"
      | "cancelled"
      | "skipped"
      | "timed_out"
      | "action_required"
      | null
      | string;
  }>;
};

type GitHubCiSnapshot = {
  status: GitHubStatus | null;
  checkRuns: GitHubCheckRuns | null;
};

type GitHubCompare = {
  ahead_by: number;
  behind_by: number;
  status: string;
};

const GITHUB_API = "https://api.github.com";

export async function loadGitHubTracker(config: TrackerConfig): Promise<TrackerDataset> {
  const slugs = config.repoSlugs.map((slug) => slug.trim()).filter(Boolean);

  if (!slugs.length) {
    throw new Error("Add at least one repository slug such as owner/repo.");
  }

  const repos = await Promise.all(slugs.map((slug) => fetchRepo(slug, config.token)));
  const pullGroups = await Promise.all(repos.map((repo) => fetchPullsForRepo(repo, config.token)));
  const pullRequests = pullGroups.flat();
  const branchGroups = await Promise.all(
    repos.map((repo) =>
      fetchBranchesForRepo(
        repo,
        pullRequests.filter((pr) => pr.repo === repo.full_name),
        config.token,
      ),
    ),
  );

  return {
    repos: repos.map<RepoSummary>((repo) => ({
      slug: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      defaultBranch: repo.default_branch,
      openPrs: pullRequests.filter((pr) => pr.repo === repo.full_name && pr.state !== "merged")
        .length,
      url: repo.html_url,
    })),
    branches: branchGroups.flat(),
    pullRequests,
    activity: buildActivity(pullRequests),
  };
}

async function fetchRepo(slug: string, token: string): Promise<GitHubRepo> {
  return request<GitHubRepo>(`/repos/${slug}`, token);
}

async function fetchBranchesForRepo(
  repo: GitHubRepo,
  pullRequests: PullRequestSummary[],
  token: string,
): Promise<BranchSummary[]> {
  const fetchedBranches = await requestPages<GitHubBranch[]>(
    `/repos/${repo.full_name}/branches?per_page=100`,
    token,
    3,
  );
  const branchByName = new Map(fetchedBranches.map((branch) => [branch.name, branch]));
  pullRequests.forEach((pr) => {
    if (!branchByName.has(pr.branch)) {
      branchByName.set(pr.branch, {
        name: pr.branch,
        commit: { sha: "", url: "" },
      });
    }
  });
  const branches = [...branchByName.values()];

  const compared = await Promise.all(
    branches.map(async (branch) => {
      if (branch.name === repo.default_branch) {
        return { branch, compare: { ahead_by: 0, behind_by: 0, status: "identical" } };
      }

      try {
        const compare = await request<GitHubCompare>(
          `/repos/${repo.full_name}/compare/${encodeURIComponent(repo.default_branch)}...${encodeURIComponent(branch.name)}`,
          token,
        );
        return { branch, compare };
      } catch {
        return { branch, compare: { ahead_by: 0, behind_by: 0, status: "unknown" } };
      }
    }),
  );

  return compared.map(({ branch, compare }) => {
    const pr = pullRequests.find((item) => item.branch === branch.name);

    return {
      id: `${repo.full_name}:${branch.name}`,
      repo: repo.full_name,
      name: branch.name,
      health: branchHealth(compare.ahead_by, compare.behind_by, branch.name === repo.default_branch),
      ahead: compare.ahead_by,
      behind: compare.behind_by,
      updatedAt: pr?.updatedAt ?? new Date().toISOString(),
      pullRequestNumber: pr?.number,
    };
  });
}

async function fetchPullsForRepo(repo: GitHubRepo, token: string): Promise<PullRequestSummary[]> {
  const pulls = await requestPages<GitHubPull[]>(
    `/repos/${repo.full_name}/pulls?state=open&sort=updated&direction=desc&per_page=100`,
    token,
    3,
  );

  const hydrated = await Promise.all(
    pulls.map(async (pull) => {
      const [reviews, reviewComments, issueComments, ci] = await Promise.all([
        request<GitHubReview[]>(`/repos/${repo.full_name}/pulls/${pull.number}/reviews`, token),
        request<GitHubComment[]>(`/repos/${repo.full_name}/pulls/${pull.number}/comments`, token),
        request<GitHubComment[]>(`/repos/${repo.full_name}/issues/${pull.number}/comments`, token),
        fetchStatus(repo.full_name, pull.head.sha, token),
      ]);

      return mapPull(repo.full_name, pull, reviews, reviewComments, issueComments, ci);
    }),
  );

  return hydrated;
}

async function fetchStatus(slug: string, sha: string, token: string): Promise<GitHubCiSnapshot> {
  const [status, checkRuns] = await Promise.all([
    request<GitHubStatus>(`/repos/${slug}/commits/${sha}/status`, token).catch(() => null),
    request<GitHubCheckRuns>(`/repos/${slug}/commits/${sha}/check-runs?per_page=100`, token).catch(() => null),
  ]);

  return { status, checkRuns };
}

async function request<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      typeof body?.message === "string" ? body.message : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function requestPages<T extends unknown[]>(
  path: string,
  token: string,
  maxPages: number,
): Promise<T[number][]> {
  const results: T[number][] = [];
  const separator = path.includes("?") ? "&" : "?";

  for (let page = 1; page <= maxPages; page += 1) {
    const pageResults = await request<T>(`${path}${separator}page=${page}`, token);
    results.push(...pageResults);
    if (pageResults.length < 100) break;
  }

  return results;
}

function mapPull(
  repo: string,
  pull: GitHubPull,
  reviews: GitHubReview[],
  reviewComments: GitHubComment[],
  issueComments: GitHubComment[],
  ci: GitHubCiSnapshot,
): PullRequestSummary {
  const reviewEvents = reviews.map<ReviewEvent>((review) => ({
    id: String(review.id),
    reviewer: mapPerson(review.user),
    state: mapReviewState(review.state),
    body: review.body,
    reaction: "none",
    submittedAt: review.submitted_at ?? pull.updated_at,
    sourceUrl: review.html_url,
  }));

  const codexCommentEvents = [...reviewComments, ...issueComments]
    .filter((comment) => isCodexSignal(comment.user?.login, comment.body))
    .map<ReviewEvent>((comment) => ({
      id: `comment-${comment.id}`,
      reviewer: { ...mapPerson(comment.user), isCodex: true },
      state: "commented",
      body: comment.body,
      reaction: reactionFromComment(comment),
      submittedAt: comment.updated_at ?? comment.created_at,
      sourceUrl: comment.html_url,
    }));

  const codexReviewEvents = reviewEvents
    .filter((event) => isCodexSignal(event.reviewer.login, event.body))
    .map((event) => ({
      ...event,
      reviewer: { ...event.reviewer, isCodex: true },
      reaction: event.state === "approved" ? ("thumbs_up" as const) : event.reaction,
    }));

  const allEvents = [...reviewEvents, ...codexCommentEvents];
  const codex = buildCodexSignal([...codexReviewEvents, ...codexCommentEvents]);
  const state = mapPullState(pull, reviews);
  const checkState = mapCheckState(ci);

  return {
    id: `${repo}#${pull.number}`,
    repo,
    number: pull.number,
    title: pull.title,
    branch: pull.head.ref,
    base: pull.base.ref,
    state,
    isDraft: Boolean(pull.draft),
    author: mapPerson(pull.user, "Author"),
    reviewers: collectReviewers(allEvents, pull.user.login),
    reviewEvents: allEvents,
    codex,
    ci: checkState,
    ciSummary: summarizeCi(ci),
    labels: pull.labels.map((label) => label.name),
    milestone: pull.milestone?.title,
    createdAt: pull.created_at,
    updatedAt: pull.updated_at,
    url: pull.html_url,
  };
}

function buildCodexSignal(events: ReviewEvent[]): CodexSignal {
  const sorted = [...events].sort(
    (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
  );
  const hasEyes = sorted.some((event) => event.reaction === "eyes");
  const hasThumbs = sorted.some(
    (event) => event.reaction === "thumbs_up" || event.state === "approved",
  );
  const exists = sorted.length > 0;
  let reaction: CodexReaction = "none";

  if (hasEyes && hasThumbs) reaction = "changed";
  else if (hasThumbs) reaction = "thumbs_up";
  else if (hasEyes) reaction = "eyes";

  return {
    exists,
    reaction,
    statusText: codexStatusText(reaction, exists),
    lastSeenAt: sorted[sorted.length - 1]?.submittedAt,
    events: sorted,
  };
}

function codexStatusText(reaction: CodexReaction, exists: boolean) {
  if (!exists) return "No Codex review yet";
  if (reaction === "changed") return "Changed from eyes to thumbs up";
  if (reaction === "thumbs_up") return "Codex approved";
  if (reaction === "eyes") return "Codex has eyes on it";
  return "Codex review found";
}

function reactionFromComment(comment: GitHubComment): CodexReaction {
  const thumbs = comment.reactions?.["+1"] ?? 0;
  const eyes = comment.reactions?.eyes ?? 0;

  if (thumbs > 0 && eyes > 0) return "changed";
  if (thumbs > 0) return "thumbs_up";
  if (eyes > 0) return "eyes";
  return "none";
}

function isCodexSignal(login?: string, body?: string) {
  return /codex|chatgpt|openai/i.test(`${login ?? ""} ${body ?? ""}`);
}

function mapPerson(user: GitHubReview["user"], role?: string): ReviewPerson {
  return {
    login: user?.login ?? "unknown",
    avatarUrl: user?.avatar_url,
    role,
    isCodex: isCodexSignal(user?.login),
  };
}

function mapReviewState(state: GitHubReview["state"]): ReviewEvent["state"] {
  if (state === "APPROVED") return "approved";
  if (state === "CHANGES_REQUESTED") return "changes_requested";
  if (state === "DISMISSED") return "dismissed";
  if (state === "PENDING") return "pending";
  return "commented";
}

function mapPullState(pull: GitHubPull, reviews: GitHubReview[]): PullRequestState {
  if (pull.merged_at) return "merged";
  if (pull.draft) return "draft";

  const latestByUser = new Map<string, GitHubReview>();
  reviews.forEach((review) => {
    if (!review.user?.login || !review.submitted_at) return;
    const previous = latestByUser.get(review.user.login);
    if (!previous || new Date(review.submitted_at) > new Date(previous.submitted_at ?? 0)) {
      latestByUser.set(review.user.login, review);
    }
  });

  const latestStates = [...latestByUser.values()].map((review) => review.state);

  if (latestStates.includes("CHANGES_REQUESTED")) return "changes_requested";
  if (latestStates.includes("APPROVED")) return "approved";
  return pull.state === "open" ? "waiting_review" : "open";
}

function mapCheckState(ci: GitHubCiSnapshot): CheckState {
  const checkRuns = ci.checkRuns?.check_runs ?? [];
  const completedRuns = checkRuns.filter((run) => run.status === "completed");
  const activeRuns = checkRuns.filter((run) => run.status !== "completed");
  const failedRun = completedRuns.some((run) =>
    ["failure", "cancelled", "timed_out", "action_required"].includes(String(run.conclusion)),
  );

  if (failedRun) return "failure";
  if (activeRuns.length > 0) return "pending";
  if (checkRuns.length > 0 && completedRuns.every((run) => ["success", "neutral", "skipped"].includes(String(run.conclusion)))) {
    return "success";
  }

  if (!ci.status || ci.status.total_count === 0) return "unknown";
  if (ci.status.state === "success") return "success";
  if (ci.status.state === "pending") return "pending";
  return "failure";
}

function summarizeCi(ci: GitHubCiSnapshot) {
  const checkRuns = ci.checkRuns?.check_runs ?? [];
  if (checkRuns.length > 0) {
    const active = checkRuns.filter((run) => run.status !== "completed").length;
    const failed = checkRuns.filter((run) =>
      run.status === "completed" &&
      ["failure", "cancelled", "timed_out", "action_required"].includes(String(run.conclusion)),
    ).length;

    if (failed > 0) return `${failed} failing ${failed === 1 ? "check" : "checks"}`;
    if (active > 0) return `${active} checks running`;
    return `${checkRuns.length} checks passed`;
  }

  if (!ci.status || ci.status.total_count === 0) return "No reported checks";
  if (ci.status.state === "success") return "All checks passed";
  if (ci.status.state === "pending") return `${ci.status.total_count} checks running`;

  const failed = ci.status.statuses.filter((status) => status.state !== "success").length;
  return `${failed} failing ${failed === 1 ? "check" : "checks"}`;
}

function branchHealth(ahead: number, behind: number, isDefault: boolean): BranchHealth {
  if (isDefault) return "healthy";
  if (ahead > 0 && behind > 0) return "diverged";
  if (behind > 0) return "behind";
  if (ahead > 0) return "ahead";
  return "healthy";
}

function collectReviewers(events: ReviewEvent[], authorLogin: string) {
  const reviewers = new Map<string, ReviewPerson>();

  events.forEach((event) => {
    if (event.reviewer.login === authorLogin) return;
    reviewers.set(event.reviewer.login, event.reviewer);
  });

  return [...reviewers.values()];
}

function buildActivity(pullRequests: PullRequestSummary[]) {
  return pullRequests
    .flatMap((pr) => {
      const events = [
        {
          id: `${pr.id}:updated`,
          repo: pr.repo,
          title: `PR #${pr.number} updated`,
          detail: pr.title,
          state: pr.state,
          at: pr.updatedAt,
        },
      ];

      if (pr.codex.exists) {
        events.push({
          id: `${pr.id}:codex`,
          repo: pr.repo,
          title: "Codex review signal",
          detail: pr.codex.statusText,
          state: pr.state,
          at: pr.codex.lastSeenAt ?? pr.updatedAt,
        });
      }

      return events;
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 20);
}
